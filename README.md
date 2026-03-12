# 🚍 Smart Public Transport Safety System for Women

A comprehensive real-time safety platform for women using public transport, built for hackathons with **all essential features working out of the box**.

## 🎯 Problem Statement

Women using public transport often feel unsafe, especially at night. Existing tools like CCTV and GPS work separately and only respond after an incident. This app provides a **smart, connected, preventive system**.

## ✨ Key Features

### For Passengers
- **🆘 SOS Emergency Button** - Instant alerts to trusted contacts and authorities
- **📍 Live GPS Tracking** - Real-time location sharing during trips
- **👥 Trusted Contacts** - Add contacts who will be notified during emergencies
- **🗺️ Route Monitoring** - Automatic detection of route deviations
- **📹 Phone Camera Surveillance** - Emergency video recording (replaces CCTV)
- **⚡ Trip Sharing** - Automatically share trip details with trusted contacts
- **🔔 Smart Alerts** - Notifications for speed violations, unusual stops, route changes

### For Drivers
- **📡 Live Location Broadcasting** - Share real-time location with passengers
- **📊 Behavior Monitoring** - AI-powered driving behavior analysis
- **⭐ Safety Score** - Real-time safety rating based on driving patterns
- **🚗 Trip Management** - Start/end trips and track performance

### For Admins
- **🎛️ Real-time Dashboard** - Monitor all active trips and vehicles
- **🚨 SOS Alert Management** - Immediate visibility of emergency situations
- **📈 Analytics** - Track safety metrics and driver performance
- **👮 Authority Integration** - Connect with emergency services

## 🛠️ Technology Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Firestore, Authentication, Storage, Cloud Messaging)
- **Maps**: React Native Maps (Google Maps / Mapbox)
- **AI/ML**: Custom algorithms for driver behavior analysis
- **Location**: Expo Location API
- **Camera**: Expo Camera API
- **Notifications**: Expo Notifications + Firebase Cloud Messaging

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Firebase project (already configured in this repo)

### Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Add Google Maps API Key** (Optional - for production)
   - Get API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Open `app.json`
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` with your key

3. **Start the app**
   ```bash
   npm start
   ```

4. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

## 🚀 Quick Demo Setup

### Test Accounts (Pre-configured)

**Passenger Account:**
- Email: `passenger@test.com`
- Password: `password123`

**Driver Account:**
- Email: `driver@test.com`
- Password: `password123`

**Admin Account:**
- Email: `admin@test.com`
- Password: `password123`

### Testing Features

1. **Test SOS Alert**
   - Login as passenger
   - Go to Home tab
   - Press red SOS button
   - Check notifications sent to contacts

2. **Test Trip Tracking**
   - Login as passenger
   - Go to Trip tab
   - Press "Start Trip"
   - View live location on map
   - Login as driver on another device to broadcast location

3. **Test Camera Surveillance**
   - Start a trip as passenger
   - Press camera icon
   - Record video or take photo
   - Video uploads to Firebase Storage

4. **Test Admin Dashboard**
   - Login as admin
   - View all active trips
   - Monitor SOS alerts
   - Check driver performance

## 📱 App Structure

```
src/
├── config/
│   └── firebase.js              # Firebase configuration
├── screens/
│   ├── LoginScreen.js           # Authentication
│   ├── RegisterScreen.js
│   ├── passenger/               # Passenger app
│   │   ├── HomeScreen.js        # Dashboard & SOS
│   │   ├── TripScreen.js        # Live tracking & alerts
│   │   ├── ContactsScreen.js    # Trusted contacts
│   │   └── ProfileScreen.js
│   ├── driver/                  # Driver app
│   │   ├── DriverHomeScreen.js
│   │   ├── DriverTripScreen.js  # Location broadcasting
│   │   └── DriverProfileScreen.js
│   └── admin/                   # Admin dashboard
│       └── AdminDashboard.js
├── services/
│   ├── SOSService.js            # Emergency alert system
│   ├── NotificationService.js   # Push notifications
│   ├── GeofencingService.js     # Route deviation detection
│   └── DriverBehaviorService.js # AI behavior analysis
└── components/
    └── CameraModal.js           # Surveillance system
```

## 🔥 Firebase Setup

This project is already configured with Firebase, but if you want to use your own:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable:
   - **Authentication** (Email/Password)
   - **Firestore Database**
   - **Storage**
   - **Cloud Messaging**
3. Copy your Firebase config
4. Replace in `src/config/firebase.js`

### Firestore Collections

The app automatically creates these collections:
- `users` - User profiles (passenger/driver/admin)
- `trips` - Active and completed trips
- `vehicles` - Vehicle information
- `sosAlerts` - Emergency alerts
- `notifications` - Alert notifications
- `driverBehavior` - Driving behavior analytics

## 🎨 Features Deep Dive

### 1. SOS System
- **Instant Alerts**: One-tap SOS triggers immediate notifications
- **Auto-SOS**: Automatically triggers on route deviation (>3 violations)
- **Multi-channel**: Sends SMS, Email, Push notifications
- **Location Sharing**: Sends exact GPS coordinates

### 2. Geofencing & Route Monitoring
- **500m Safe Zone**: Alerts if vehicle leaves expected route
- **Unusual Stop Detection**: Alerts for stops >10 minutes
- **Automatic Escalation**: Auto-SOS after multiple violations

### 3. AI Driver Behavior Analysis
- **Speed Monitoring**: Tracks and flags overspeeding (>80 km/h)
- **Acceleration Patterns**: Detects harsh braking/acceleration
- **Risk Scoring**: 0-100 safety score based on behavior
- **Driver Rating**: Automatic performance evaluation

### 4. Camera Surveillance
- **Emergency Recording**: Replaces traditional CCTV
- **Photo & Video**: Capture evidence during emergency
- **Cloud Upload**: Automatically uploads to Firebase Storage
- **Trip Association**: Links recordings to specific trips

## 🏆 Hackathon Demo Script

### 5-Minute Pitch Demo

1. **Problem (30 sec)**
   - Show statistics on women's safety in public transport
   - Explain gaps in current systems

2. **Solution (1 min)**
   - Live demo of passenger app
   - Show SOS button and instant alerts
   - Demonstrate live tracking

3. **Key Features (2 min)**
   - **SOS Alert**: Trigger and show notification
   - **Live Tracking**: Show map with real-time location
   - **Route Monitoring**: Demonstrate deviation alert
   - **Camera**: Record video using phone
   - **Driver Score**: Show behavior analysis

4. **Technical Stack (1 min)**
   - React Native for cross-platform
   - Firebase for real-time sync
   - AI for behavior monitoring
   - Geofencing for safety zones

5. **Impact & Future (30 sec)**
   - Scalability to buses, taxis, ride-shares
   - Integration with authorities
   - Expansion to other safety scenarios

## 📊 Performance & Scalability

- **Real-time Updates**: 3-second location refresh
- **Offline Support**: Works with intermittent connectivity
- **Battery Optimized**: Smart location tracking
- **Scalable**: Firebase handles thousands of concurrent users
- **Cost Effective**: Serverless architecture

## 🔐 Privacy & Security

- **Consent-based Tracking**: Only during active trips
- **Encrypted Data**: All communications encrypted
- **Data Retention**: Automatic deletion after 90 days
- **Role-based Access**: Strict permission controls
- **Privacy Controls**: Users control what's shared

## 🐛 Troubleshooting

### Common Issues

**"Location permission denied"**
- Go to phone Settings → App → Permissions
- Enable Location (Always)

**"Camera not working"**
- Enable camera permission in app settings
- Restart the app

**"Firebase connection error"**
- Check internet connection
- Verify Firebase config in `firebase.js`

**"Map not loading"**
- Add Google Maps API key in `app.json`
- Enable Maps SDK in Google Cloud Console

## 🤝 Contributing

This is a hackathon project. Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Use for your own hackathons (with attribution)

## 📄 License

MIT License - Free for hackathons and educational use

## 👥 Team

Built for HackAtharva Hackathon

## 📞 Support

For hackathon support or questions:
- Create an issue on GitHub
- Contact: [Your Email]

## 🎉 Acknowledgments

- Firebase for backend infrastructure
- Expo for React Native tooling
- Google Maps for location services
- React Native community

---

**Built with ❤️ for women's safety**

*Last Updated: March 12, 2026*
