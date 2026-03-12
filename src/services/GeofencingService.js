import { getDistance, isPointInPolygon } from 'geolib';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import NotificationService from './NotificationService';
import SOSService from './SOSService';

class GeofencingService {
  constructor() {
    this.routePolyline = [];
    this.allowedRadius = 500; // meters
    this.lastViolation = null;
    this.violationCount = 0;
    this.lastKnownLocation = null;
    this.stopStartTime = null;
  }

  // Set the expected route for the trip
  setRoute(routeCoordinates) {
    this.routePolyline = routeCoordinates;
  }

  // Check if current location is within allowed area
  checkGeofence(currentLocation, tripId) {
    if (this.routePolyline.length === 0) {
      // No route set, can't check
      return { isWithinBounds: true };
    }

    // Find closest point on route
    const closestPoint = this.findClosestPointOnRoute(currentLocation);
    
    if (!closestPoint) {
      return { isWithinBounds: true };
    }

    // Calculate distance from route
    const distance = getDistance(currentLocation, closestPoint);

    const isWithinBounds = distance <= this.allowedRadius;

    if (!isWithinBounds) {
      this.handleViolation(currentLocation, distance, tripId);
    } else {
      // Reset violation count if back on route
      this.violationCount = 0;
    }

    return {
      isWithinBounds,
      distance,
      closestPoint,
      violationCount: this.violationCount,
    };
  }

  // Find the closest point on the route to current location
  findClosestPointOnRoute(currentLocation) {
    if (this.routePolyline.length === 0) return null;

    let minDistance = Infinity;
    let closestPoint = null;

    this.routePolyline.forEach((point) => {
      const distance = getDistance(currentLocation, point);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    return closestPoint;
  }

  // Handle geofence violation
  async handleViolation(location, distance, tripId) {
    const now = Date.now();

    // Increment violation count
    this.violationCount++;

    // Only trigger alert if:
    // 1. First violation, OR
    // 2. Last violation was more than 2 minutes ago, OR
    // 3. More than 3 violations in sequence
    const shouldAlert =
      !this.lastViolation ||
      now - this.lastViolation > 120000 ||
      this.violationCount > 3;

    if (shouldAlert) {
      this.lastViolation = now;

      // Notify about route deviation
      await NotificationService.notifyRouteDeviation(tripId, location);

      // If severe deviation (> 3 violations), auto-trigger SOS
      if (this.violationCount > 3) {
        await SOSService.autoTriggerSOS(
          'auto',
          'Possible route deviation - vehicle has left safe zone multiple times',
          location,
          tripId
        );
      }
    }
  }

  // Detect if vehicle has stopped for too long
  checkForUnusualStop(currentLocation, speed, tripId) {
    const isMoving = speed > 1; // 1 m/s threshold

    if (!isMoving) {
      if (!this.stopStartTime) {
        // Just stopped
        this.stopStartTime = Date.now();
        this.lastKnownLocation = currentLocation;
      } else {
        // Check how long stopped
        const stopDuration = (Date.now() - this.stopStartTime) / 60000; // in minutes

        // Alert if stopped for more than 10 minutes
        if (stopDuration > 10) {
          this.handleUnusualStop(currentLocation, stopDuration, tripId);
        }
      }
    } else {
      // Moving again, reset
      this.stopStartTime = null;
    }

    return {
      isStopped: !isMoving,
      stopDuration: this.stopStartTime
        ? (Date.now() - this.stopStartTime) / 60000
        : 0,
    };
  }

  // Handle unusual stop
  async handleUnusualStop(location, duration, tripId) {
    // Check if this is a designated stop area (bus stops, etc.)
    const isDesignatedStop = await this.checkDesignatedStop(location);

    if (!isDesignatedStop) {
      // Notify about unusual stop
      await NotificationService.notifyLongStop(tripId, Math.round(duration));

      // If stopped for more than 15 minutes, auto-trigger SOS
      if (duration > 15) {
        await SOSService.autoTriggerSOS(
          'auto',
          `Vehicle stopped for ${Math.round(duration)} minutes at unexpected location`,
          location,
          tripId
        );
      }
    }

    // Reset to avoid multiple alerts for same stop
    this.stopStartTime = Date.now();
  }

  // Check if location is a designated stop area
  async checkDesignatedStop(location) {
    try {
      // In a real app, this would check against a database of bus stops, etc.
      // For demo, we'll return false
      return false;
    } catch (error) {
      console.error('Error checking designated stop:', error);
      return false;
    }
  }

  // Create a geofence polygon around a route
  createRouteBuffer(routeCoordinates, bufferRadius = 500) {
    // This would create a polygon around the route with given buffer
    // For simplicity, we're using point-to-route distance checking
    this.routePolyline = routeCoordinates;
    this.allowedRadius = bufferRadius;
  }

  // Predict ETA based on current location and route
  calculateETA(currentLocation, destination, averageSpeed) {
    const distance = getDistance(currentLocation, destination);
    
    // Convert speed from m/s to km/h
    const speedKmh = averageSpeed * 3.6;
    
    if (speedKmh === 0) return null;

    // Calculate time in hours
    const timeHours = distance / 1000 / speedKmh;
    
    // Convert to minutes
    const timeMinutes = timeHours * 60;

    return {
      distance: distance / 1000, // in km
      timeMinutes: Math.round(timeMinutes),
      eta: new Date(Date.now() + timeMinutes * 60000).toISOString(),
    };
  }

  // Check if two locations are significantly different (for location updates)
  hasLocationChanged(loc1, loc2, threshold = 10) {
    if (!loc1 || !loc2) return true;
    
    const distance = getDistance(loc1, loc2);
    return distance > threshold; // meters
  }

  // Reset for new trip
  reset() {
    this.routePolyline = [];
    this.lastViolation = null;
    this.violationCount = 0;
    this.lastKnownLocation = null;
    this.stopStartTime = null;
  }
}

export default new GeofencingService();
