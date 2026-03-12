# 🚀 Quick Setup Guide - Smart Transport Safety

## ⚡ Fast Track (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the App
```bash
npm start
```

### Step 3: Run on Device
- For iOS: Press `i` in terminal
- For Android: Press `a` in terminal
- For Phone: Scan QR code with Expo Go app

### Step 4: Test the App

**Create a Test Account:**
1. Open app
2. Click "Register"
3. Fill details
4. Select role: Passenger/Driver/Admin

**Or use pre-configured accounts:**
- Passenger: `passenger@test.com` / `password123`
- Driver: `driver@test.com` / `password123`
- Admin: `admin@test.com` / `password123`

## 🎯 Feature Testing Checklist

### ✅ Passenger Features
- [ ] Register/Login
- [ ] Press SOS button
- [ ] Start a trip
- [ ] View live tracking on map
- [ ] Add trusted contacts
- [ ] Open camera surveillance
- [ ] View profile and stats

### ✅ Driver Features
- [ ] Register/Login as driver
- [ ] Go online/offline
- [ ] Start trip broadcasting
- [ ] View real-time speed
- [ ] Check safety score
- [ ] End trip

### ✅ Admin Features
- [ ] Login as admin
- [ ] View all active trips
- [ ] Monitor SOS alerts
- [ ] Check vehicle status
- [ ] View analytics

## 🔧 Configuration (Optional)

### Adding Google Maps API Key

1. Get free API key: https://console.cloud.google.com/
2. Open `app.json`
3. Find `android.config.googleMaps.apiKey`
4. Replace `YOUR_GOOGLE_MAPS_API_KEY`

### Firebase (Already Configured)

Firebase is already set up and working. To use your own:

1. Create project: https://console.firebase.google.com/
2. Enable:
   - Authentication (Email/Password)
   - Firestore Database
   - Storage
   - Cloud Messaging
3. Copy config to `src/config/firebase.js`

## 📱 Device Requirements

- **For iOS**: iPhone 12 or newer (iOS 14+)
- **For Android**: Android 5.0+ (API 21)
- **For Simulator**: Xcode (Mac) or Android Studio

## ⚠️ Common Issues

**App not starting?**
```bash
# Clear cache
expo start -c
```

**Location not working?**
- Enable location permissions
- Restart app

**Camera not working?**
- Enable camera permissions
- Check if another app is using camera

## 🎨 Customization

### Change App Colors
Edit `src/screens/*/styles.js`

### Add Routes
Edit `src/services/GeofencingService.js`

### Change Alert Thresholds
Edit `src/services/DriverBehaviorService.js`

## 🏆 Hackathon Tips

**For Best Demo:**
1. Use 2 devices: One passenger, one driver
2. Simulate a trip scenario
3. Trigger SOS alert to show real-time response
4. Show admin dashboard on laptop/tablet

**Wow Factors:**
- Live location sync between devices
- Instant SOS notifications
- Camera surveillance recording
- AI driver behavior scoring
- Real-time geofence violations

## 📊 Testing Scenarios

### Scenario 1: Safe Trip
1. Passenger starts trip
2. Driver broadcasts location
3. Trip completes normally

### Scenario 2: Route Deviation
1. Passenger starts trip
2. Driver goes off route (simulated)
3. Automatic alert triggered
4. Admin sees alert on dashboard

### Scenario 3: Emergency
1. Passenger presses SOS
2. Trusted contacts notified
3. Camera starts recording
4. Admin responds

### Scenario 4: Bad Driving
1. Driver starts trip
2. Speeds above 80 km/h
3. Safety score drops
4. Alerts generated

## 🚀 Next Steps

After basic setup:
1. Add real bus routes
2. Integrate SMS gateway (Twilio)
3. Connect police control room API
4. Add offline map caching
5. Implement video streaming

## 📞 Need Help?

**Can't get it working?**
1. Check all dependencies installed: `npm install`
2. Verify Node.js version: `node --version` (should be 18+)
3. Clear Expo cache: `expo start -c`
4. Reinstall expo-cli: `npm install -g expo-cli`

**Still stuck?**
- Check `README.md` for detailed docs
- Open GitHub issue
- Email support

---

**You're all set! Start building your demo! 🎉**
