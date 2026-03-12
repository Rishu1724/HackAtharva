# 🚀 Deployment & Production Guide

## 📱 Building for Production

### iOS Build

**Prerequisites:**
- Mac computer
- Xcode installed
- Apple Developer Account ($99/year)

**Steps:**
```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Configure build
eas build:configure

# 4. Build for iOS
eas build --platform ios

# 5. Submit to App Store
eas submit --platform ios
```

### Android Build

**Prerequisites:**
- Android Studio installed
- Google Play Developer Account ($25 one-time)

**Steps:**
```bash
# 1. Build APK for testing
eas build --platform android --profile preview

# 2. Build AAB for Play Store
eas build --platform android --profile production

# 3. Submit to Play Store
eas submit --platform android
```

## 🔧 Production Configuration

### Firebase Production Setup

1. **Create Production Firebase Project**
   ```
   - Go to console.firebase.google.com
   - Create new project: "smart-transport-prod"
   - Enable same services as dev
   ```

2. **Update Firebase Config**
   ```javascript
   // src/config/firebase.js
   const firebaseConfig = {
     apiKey: process.env.FIREBASE_API_KEY,
     authDomain: process.env.FIREBASE_AUTH_DOMAIN,
     // ... rest from production project
   };
   ```

3. **Environment Variables**
   ```bash
   # Create .env file
   FIREBASE_API_KEY=your_prod_api_key
   FIREBASE_AUTH_DOMAIN=your_prod_domain
   FIREBASE_PROJECT_ID=your_prod_project_id
   GOOGLE_MAPS_API_KEY=your_maps_key
   ```

### Google Maps Setup

1. **Get API Key**
   - Go to console.cloud.google.com
   - Enable Maps SDK for iOS
   - Enable Maps SDK for Android
   - Enable Places API
   - Create API key

2. **Add Restrictions**
   - Add app bundle ID for iOS
   - Add package name for Android
   - Limit to required APIs only

3. **Update app.json**
   ```json
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "YOUR_ANDROID_MAPS_KEY"
       }
     }
   },
   "ios": {
     "config": {
       "googleMapsApiKey": "YOUR_IOS_MAPS_KEY"
     }
   }
   ```

## 🔔 Push Notifications Setup

### Firebase Cloud Messaging

1. **Get FCM Server Key**
   ```
   - Firebase Console → Project Settings
   - Cloud Messaging tab
   - Copy Server Key
   ```

2. **iOS Configuration**
   ```
   - Get APNs Auth Key from Apple
   - Upload to Firebase Console
   - Update app.json with required capabilities
   ```

3. **Android Configuration**
   ```
   - Download google-services.json
   - Place in project root
   - Configure in app.json
   ```

## 🌐 Backend Services

### SMS Gateway Integration

**Option 1: Twilio**
```javascript
// Add to SOSService.js
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

async sendSMS(phone, message) {
  await client.messages.create({
    body: message,
    from: '+1234567890',
    to: phone
  });
}
```

**Option 2: AWS SNS**
```javascript
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

await sns.publish({
  Message: message,
  PhoneNumber: phone
}).promise();
```

### Email Service

**Using SendGrid:**
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: 'alerts@smarttransport.com',
  subject: 'Emergency Alert',
  text: message,
  html: `<strong>${message}</strong>`
});
```

## 🚨 Emergency Services Integration

### Police Control Room API

```javascript
// Add to SOSService.js
async notifyPolice(alert) {
  try {
    const response = await fetch('https://police-api.gov/emergency', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.POLICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'SOS_ALERT',
        location: alert.location,
        userId: alert.userId,
        timestamp: alert.timestamp,
        priority: 'HIGH'
      })
    });
    
    return response.json();
  } catch (error) {
    console.error('Failed to notify police:', error);
    // Fallback to SMS/Call
  }
}
```

## 📊 Analytics Setup

### Firebase Analytics

```javascript
import analytics from '@react-native-firebase/analytics';

// Track events
await analytics().logEvent('sos_triggered', {
  userId: userId,
  location: location,
  timestamp: Date.now()
});

await analytics().logEvent('trip_started', {
  driverId: driverId,
  route: route
});
```

### Custom Dashboard

```javascript
// Create analytics collection in Firestore
await db.collection('analytics').add({
  event: 'sos_alert',
  userId: userId,
  timestamp: new Date(),
  metadata: { /* ... */ }
});
```

## 🔒 Security Hardening

### 1. Environment Variables
```bash
# Never commit these!
FIREBASE_API_KEY=...
GOOGLE_MAPS_API_KEY=...
TWILIO_AUTH_TOKEN=...
SENDGRID_API_KEY=...
```

### 2. Firebase Security Rules
```javascript
// Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    match /trips/{tripId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.userId;
    }
    
    match /sosAlerts/{alertId} {
      allow read: if request.auth.token.role == 'admin';
      allow create: if request.auth != null;
    }
  }
}
```

### 3. API Rate Limiting
```javascript
// Add rate limiting middleware
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## 🚀 Deployment Checklist

### Pre-launch
- [ ] All features tested on iOS
- [ ] All features tested on Android
- [ ] Firebase security rules updated
- [ ] API keys secured
- [ ] Push notifications working
- [ ] SMS/Email integration working
- [ ] Error tracking setup (Sentry)
- [ ] Privacy policy created
- [ ] Terms of service created
- [ ] App store listings ready

### App Store Submission
- [ ] Screenshots (5-10 per platform)
- [ ] App description written
- [ ] Keywords optimized for ASO
- [ ] Privacy policy link added
- [ ] Support email/website added
- [ ] Age rating selected
- [ ] Test account provided to Apple/Google

### Post-launch
- [ ] Monitor crash reports
- [ ] Track user adoption
- [ ] Collect user feedback
- [ ] Fix critical bugs
- [ ] Plan feature updates

## 📈 Scaling Considerations

### Database
```
Current: Firebase Firestore (Good for 1M users)
Scale to: MongoDB + Redis cache (10M+ users)
```

### Cloud Functions
```javascript
// Add Firebase Cloud Functions for heavy processing
exports.processBehaviorAnalysis = functions.firestore
  .document('trips/{tripId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    // Heavy AI processing
    const analysis = await analyzeDriverBehavior(newData);
    await updateDriverScore(analysis);
  });
```

### CDN for Media
```
Current: Firebase Storage
Scale to: AWS S3 + CloudFront CDN
```

## 💰 Cost Estimates

### Development (Free Tier)
- Firebase: Free up to 50K reads/day
- Google Maps: $200 free credit/month
- Twilio: Trial account

### Production (1000 active users)
- Firebase: ~$25/month
- Google Maps: ~$50/month
- Twilio SMS: ~$100/month
- SendGrid: ~$15/month
- **Total: ~$190/month**

### Enterprise (100K users)
- Firebase: ~$500/month
- Google Maps: ~$1000/month
- Twilio: ~$5000/month
- AWS hosting: ~$500/month
- **Total: ~$7000/month**

## 🎯 Go-to-Market Strategy

### Phase 1: Pilot (Month 1-3)
- Partner with 1 transport company
- Deploy on 10-20 buses
- Onboard 100-500 users
- Collect feedback

### Phase 2: City-wide (Month 4-6)
- Expand to 100+ buses
- 5000+ active users
- Police integration
- Media coverage

### Phase 3: Regional (Month 7-12)
- Partner with state transport
- 10+ cities
- 50K+ users
- Monetization starts

## 🤝 Partnership Opportunities

### Transport Companies
- Free for first 6 months
- Then $1000/month per 100 vehicles

### Government
- Free for public transport
- Co-branding opportunity

### Insurance Companies
- Discount for safe-rated drivers
- Revenue share on premiums

## 📞 Support & Maintenance

### Monitoring Tools
- **Sentry**: Error tracking
- **Firebase Performance**: App performance
- **Google Analytics**: User behavior
- **Datadog**: Infrastructure monitoring

### Update Schedule
- **Critical bugs**: Immediate hotfix
- **Minor bugs**: Weekly update
- **Features**: Monthly release

---

**Ready for production? Let's make public transport safer! 🚀**
