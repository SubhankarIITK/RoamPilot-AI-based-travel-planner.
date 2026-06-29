import mongoose from 'mongoose';

const travelProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  budgetType: { type: String, enum: ['budget', 'mid-range', 'luxury'], default: 'mid-range' },
  foodPreference: { type: String, default: 'no-preference' },
  hotelPreference: { type: String, default: 'hotel' },
  preferredTransport: [String],
  travelPace: { type: String, enum: ['relaxed', 'balanced', 'packed'], default: 'balanced' },
  interests: [String],
  medicalConstraints: { type: String, default: '' },
  accessibilityNeeds: { type: String, default: '' },
  countriesVisited: [String],
  dreamDestinations: [String],
  dislikedThings: [String],
  preferredClimate: { type: String, default: '' },
  adventureLevel: { type: Number, min: 1, max: 10, default: 5 },
  nightlifePreference: { type: String, default: 'moderate' },
  shoppingPreference: { type: String, default: 'moderate' },
  languageComfort: [String],
  travelExperienceLevel: { type: String, enum: ['beginner', 'intermediate', 'expert'], default: 'intermediate' },
}, { timestamps: true });

export default mongoose.model('TravelProfile', travelProfileSchema);