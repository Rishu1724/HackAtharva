import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class DriverBehaviorService {
  constructor() {
    this.speedHistory = [];
    this.accelerationHistory = [];
    this.stopHistory = [];
    this.riskScore = 0;
  }

  // Analyze driver behavior based on speed patterns
  analyzeSpeedPattern(speed, timestamp) {
    this.speedHistory.push({ speed, timestamp });

    // Keep only last 100 readings
    if (this.speedHistory.length > 100) {
      this.speedHistory.shift();
    }

    // Calculate metrics
    const avgSpeed = this.calculateAverageSpeed();
    const maxSpeed = this.calculateMaxSpeed();
    const speedVariance = this.calculateSpeedVariance();

    // Detect risky behavior
    const risks = [];

    // Over-speeding
    if (maxSpeed > 100) {
      risks.push({
        type: 'over_speeding',
        severity: 'high',
        value: maxSpeed,
        message: `Maximum speed ${maxSpeed} km/h exceeded safe limit`,
      });
    }

    // Erratic speed changes
    if (speedVariance > 30) {
      risks.push({
        type: 'erratic_driving',
        severity: 'medium',
        value: speedVariance,
        message: 'Frequent and sudden speed changes detected',
      });
    }

    // Calculate risk score (0-100)
    this.riskScore = this.calculateRiskScore(risks);

    return {
      avgSpeed,
      maxSpeed,
      speedVariance,
      risks,
      riskScore: this.riskScore,
      timestamp: new Date().toISOString(),
    };
  }

  // Analyze acceleration patterns
  analyzeAcceleration(currentSpeed, previousSpeed, timeDelta) {
    if (timeDelta === 0) return null;

    const acceleration = (currentSpeed - previousSpeed) / timeDelta;

    this.accelerationHistory.push({
      acceleration,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50 readings
    if (this.accelerationHistory.length > 50) {
      this.accelerationHistory.shift();
    }

    const risks = [];

    // Harsh acceleration (> 3 m/s²)
    if (Math.abs(acceleration) > 3) {
      risks.push({
        type: acceleration > 0 ? 'harsh_acceleration' : 'harsh_braking',
        severity: 'high',
        value: acceleration,
        message: `${acceleration > 0 ? 'Harsh acceleration' : 'Harsh braking'} detected`,
      });
    }

    return {
      acceleration,
      risks,
      timestamp: new Date().toISOString(),
    };
  }

  // Detect unusual stops
  detectUnusualStop(location, duration) {
    this.stopHistory.push({
      location,
      duration,
      timestamp: new Date().toISOString(),
    });

    const risks = [];

    // Stop longer than 10 minutes in non-designated area
    if (duration > 10) {
      risks.push({
        type: 'long_stop',
        severity: 'medium',
        duration,
        location,
        message: `Vehicle stopped for ${duration} minutes`,
      });
    }

    // Frequent stops (more than 5 in last hour)
    const recentStops = this.stopHistory.filter(
      (stop) =>
        new Date().getTime() - new Date(stop.timestamp).getTime() < 3600000
    );

    if (recentStops.length > 5) {
      risks.push({
        type: 'frequent_stops',
        severity: 'low',
        count: recentStops.length,
        message: `${recentStops.length} stops in the last hour`,
      });
    }

    return {
      duration,
      location,
      risks,
      timestamp: new Date().toISOString(),
    };
  }

  // Calculate comprehensive risk score
  calculateRiskScore(risks) {
    let score = 0;

    risks.forEach((risk) => {
      switch (risk.severity) {
        case 'high':
          score += 30;
          break;
        case 'medium':
          score += 15;
          break;
        case 'low':
          score += 5;
          break;
      }
    });

    // Consider historical behavior
    const recentHighRisks = this.speedHistory.filter(
      (reading) => reading.speed > 80
    ).length;

    score += recentHighRisks * 2;

    // Cap at 100
    return Math.min(score, 100);
  }

  // Get driver rating based on risk score
  getDriverRating() {
    if (this.riskScore < 20) return { rating: 5, label: 'Excellent' };
    if (this.riskScore < 40) return { rating: 4, label: 'Good' };
    if (this.riskScore < 60) return { rating: 3, label: 'Average' };
    if (this.riskScore < 80) return { rating: 2, label: 'Poor' };
    return { rating: 1, label: 'Dangerous' };
  }

  // Save behavior analysis to database
  async saveBehaviorAnalysis(driverId, tripId, analysis) {
    try {
      await addDoc(collection(db, 'driverBehavior'), {
        driverId,
        tripId,
        analysis,
        riskScore: this.riskScore,
        rating: this.getDriverRating(),
        timestamp: new Date().toISOString(),
      });

      // Update driver's overall rating
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      if (driverDoc.exists()) {
        const currentRating = driverDoc.data().rating || { score: 0, count: 0 };
        const newScore =
          (currentRating.score * currentRating.count + this.riskScore) /
          (currentRating.count + 1);

        await updateDoc(doc(db, 'drivers', driverId), {
          rating: {
            score: newScore,
            count: currentRating.count + 1,
            lastUpdated: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Error saving behavior analysis:', error);
    }
  }

  // Helper methods
  calculateAverageSpeed() {
    if (this.speedHistory.length === 0) return 0;
    const sum = this.speedHistory.reduce((acc, reading) => acc + reading.speed, 0);
    return sum / this.speedHistory.length;
  }

  calculateMaxSpeed() {
    if (this.speedHistory.length === 0) return 0;
    return Math.max(...this.speedHistory.map((reading) => reading.speed));
  }

  calculateSpeedVariance() {
    if (this.speedHistory.length < 2) return 0;
    const avg = this.calculateAverageSpeed();
    const squaredDiffs = this.speedHistory.map((reading) =>
      Math.pow(reading.speed - avg, 2)
    );
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / this.speedHistory.length;
    return Math.sqrt(variance);
  }

  // Reset for new trip
  reset() {
    this.speedHistory = [];
    this.accelerationHistory = [];
    this.stopHistory = [];
    this.riskScore = 0;
  }
}

export default new DriverBehaviorService();
