import mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Political parties enum based on your React Native component
const POLITICAL_PARTIES = [
    'BJP', // Bharatiya Janata Party
    'JDU', // Janata Dal (United)
    'RJD', // Rashtriya Janata Dal
    'INC', // Indian National Congress
    'LJP'  // Lok Janshakti Party
];

// Bihar areas from your component
const BIHAR_AREAS = [
    "Valmiki Nagar", "Paschim Champaran", "Purvi Champaran", "Sheohar", 
    "Sitamarhi", "Madhubani", "Jhanjharpur", "Supaul", "Araria", 
    "Kishanganj", "Katihar", "Purnia", "Madhepura", "Darbhanga", 
    "Muzaffarpur", "Vaishali", "Gopalganj (SC)", "Siwan", "Maharajganj", 
    "Saran", "Hajipur (SC)", "Ujiarpur", "Samastipur (SC)", "Begusarai", 
    "Khagaria", "Bhagalpur", "Banka", "Munger", "Nalanda", "Patna Sahib", 
    "Pataliputra", "Arrah", "Buxar", "Sasaram (SC)", "Karakat", 
    "Jehanabad", "Aurangabad", "Gaya (SC)", "Nawada", "Jamui (SC)"
];

// Individual prediction for a constituency
const constituencyPredictionSchema = new Schema({
    constituency: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    area: {
        type: String,
        required: true,
        enum: BIHAR_AREAS,
        index: true
    },
    predictedParty: {
        type: String,
        required: true,
        enum: POLITICAL_PARTIES
    },
    confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 50,
        required: true
    },
    isLocked: {
        type: Boolean,
        default: false
    },
    lockedAt: {
        type: Date,
        default: null
    },
    lastModified: {
        type: Date,
        default: Date.now
    }
}, {
    // _id: false // This will be embedded, so no separate _id needed,
    timestamps: true
});

// Main prediction schema
const predictionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    electionType: {
        type: String,
        enum: ['assembly', 'lok_sabha', 'by_election'],
        default: 'assembly',
        required: true
    },
    electionYear: {
        type: Number,
        required: true,
        index: true
    },
    state: {
        type: String,
        default: 'Bihar',
        required: true,
        index: true
    },
    totalConstituencies: {
        type: Number,
        default: 243, // Bihar has 243 constituencies
        required: true
    },
    predictions: [constituencyPredictionSchema],
    
    // Overall prediction summary
    overallWinner: {
        type: String,
        enum: POLITICAL_PARTIES,
        default: null
    },
    partyWiseSeats: {
        BJP: { type: Number, default: 0 },
        JDU: { type: Number, default: 0 },
        RJD: { type: Number, default: 0 },
        INC: { type: Number, default: 0 },
        LJP: { type: Number, default: 0 }
    },
    
    // Gamification elements
    totalCoins: {
        type: Number,
        default: 0,
        min: 0
    },
    totalPredictions: {
        type: Number,
        default: 0,
        min: 0
    },
    lockedPredictions: {
        type: Number,
        default: 0,
        min: 0
    },
    predictionAccuracy: {
        type: Number,
        min: 0,
        max: 100,
        default: null // Will be calculated after actual results
    },
    
    // Status and metadata
    status: {
        type: String,
        enum: ['draft', 'submitted', 'completed', 'verified'],
        default: 'draft'
    },
    submittedAt: {
        type: Date,
        default: null
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    
    // Analytics
    timeSpentMinutes: {
        type: Number,
        default: 0,
        min: 0
    },
    deviceInfo: {
        platform: String,
        version: String,
        userAgent: String
    }
}, {
    timestamps: true,
    collection: 'predictions'
});

// Indexes for better query performance
predictionSchema.index({ userId: 1, electionYear: 1, state: 1 });
predictionSchema.index({ "predictions.area": 1 });
predictionSchema.index({ "predictions.constituency": 1 });
predictionSchema.index({ status: 1, isPublic: 1 });
predictionSchema.index({ createdAt: -1 });

// Pre-save middleware to update summary data
predictionSchema.pre('save', function(next) {
    // Update counts
    this.totalPredictions = this.predictions.length;
    this.lockedPredictions = this.predictions.filter(p => p.isLocked).length;
    
    // Calculate party-wise seat predictions
    const seatCounts = {
        BJP: 0, JDU: 0, RJD: 0, INC: 0, LJP: 0
    };
    
    this.predictions.forEach(prediction => {
        if (seatCounts.hasOwnProperty(prediction.predictedParty)) {
            seatCounts[prediction.predictedParty]++;
        }
    });
    
    this.partyWiseSeats = seatCounts;
    
    // Determine overall winner (party with most seats)
    const maxSeats = Math.max(...Object.values(seatCounts));
    if (maxSeats > 0) {
        this.overallWinner = Object.keys(seatCounts).find(
            party => seatCounts[party] === maxSeats
        );
    }
    
    this.lastUpdated = new Date();
    next();
});

// Instance methods
predictionSchema.methods.addPrediction = function(constituency, area, predictedParty, confidence = 50) {
    // Check if prediction already exists
    const existingIndex = this.predictions.findIndex(
        p => p.constituency === constituency
    );
    
    if (existingIndex !== -1) {
        // Update existing prediction if not locked
        if (!this.predictions[existingIndex].isLocked) {
            this.predictions[existingIndex].predictedParty = predictedParty;
            this.predictions[existingIndex].confidence = confidence;
            this.predictions[existingIndex].lastModified = new Date();
            return { success: true, action: 'updated' };
        } else {
            return { success: false, error: 'Prediction is locked' };
        }
    } else {
        // Add new prediction
        this.predictions.push({
            constituency,
            area,
            predictedParty,
            confidence,
            lastModified: new Date()
        });
        return { success: true, action: 'created' };
    }
};

predictionSchema.methods.lockPrediction = function(constituency) {
    const prediction = this.predictions.find(p => p.constituency === constituency);
    if (!prediction) {
        return { success: false, error: 'Prediction not found' };
    }
    
    if (prediction.isLocked) {
        return { success: false, error: 'Already locked' };
    }
    
    prediction.isLocked = true;
    prediction.lockedAt = new Date();
    return { success: true };
};

predictionSchema.methods.getPredictionByConstituency = function(constituency) {
    return this.predictions.find(p => p.constituency === constituency);
};

predictionSchema.methods.getPredictionsByArea = function(area) {
    return this.predictions.filter(p => p.area === area);
};

predictionSchema.methods.calculateProgress = function() {
    return {
        total: this.totalConstituencies,
        completed: this.totalPredictions,
        locked: this.lockedPredictions,
        percentage: Math.round((this.totalPredictions / this.totalConstituencies) * 100)
    };
};

// Static methods
predictionSchema.statics.findByUser = function(userId, electionYear = new Date().getFullYear()) {
    return this.findOne({ 
        userId: userId, 
        electionYear: electionYear,
        state: 'Bihar'
    });
};

predictionSchema.statics.getLeaderboard = function(electionYear = new Date().getFullYear(), limit = 10) {
    return this.find({ 
        electionYear: electionYear,
        state: 'Bihar',
        status: { $in: ['submitted', 'completed'] },
        isPublic: true
    })
    .populate('userId', 'username fullName avatar points')
    .sort({ 
        totalPredictions: -1, 
        lockedPredictions: -1, 
        totalCoins: -1 
    })
    .limit(limit);
};

predictionSchema.statics.getAreaAnalytics = function(area, electionYear = new Date().getFullYear()) {
    return this.aggregate([
        { $match: { electionYear: electionYear, state: 'Bihar' } },
        { $unwind: '$predictions' },
        { $match: { 'predictions.area': area } },
        {
            $group: {
                _id: {
                    constituency: '$predictions.constituency',
                    party: '$predictions.predictedParty'
                },
                count: { $sum: 1 },
                avgConfidence: { $avg: '$predictions.confidence' }
            }
        },
        {
            $group: {
                _id: '$_id.constituency',
                partyPredictions: {
                    $push: {
                        party: '$_id.party',
                        count: '$count',
                        avgConfidence: '$avgConfidence'
                    }
                },
                totalPredictions: { $sum: '$count' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

// Virtual for completion percentage
predictionSchema.virtual('completionPercentage').get(function() {
    return Math.round((this.totalPredictions / this.totalConstituencies) * 100);
});

// Ensure virtuals are included in JSON output
predictionSchema.set('toJSON', { virtuals: true });
predictionSchema.set('toObject', { virtuals: true });

// Add pagination plugin
predictionSchema.plugin(mongoosePaginate);

export const Prediction = mongoose.model("Prediction", predictionSchema);