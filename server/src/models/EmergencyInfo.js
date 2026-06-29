import mongoose from 'mongoose';

const emergencyInfoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  emergencyContacts: [{ name: String, phone: String, relation: String }],
  hotelAddress: { type: String, default: '' },
  localEmergencyNumbers: { type: mongoose.Schema.Types.Mixed, default: {} },
  allergies: [String],
  medicalNotes: { type: String, default: '' },
  embassyInfo: { type: String, default: '' },
  insuranceInfo: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('EmergencyInfo', emergencyInfoSchema);