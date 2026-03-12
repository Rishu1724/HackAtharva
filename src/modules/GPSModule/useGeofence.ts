import { useCallback, useMemo, useState } from 'react';
import { getDistance } from 'geolib';

export type RoutePoint = {
  lat: number;
  lng: number;
};

export type GeoCheckResult = {
  deviated: boolean;
  distance: number;
};

type UseGeofenceParams = {
  expectedRoute: RoutePoint[];
  maxDeviationMeters?: number;
};

function minDistanceToRoute(current: RoutePoint, route: RoutePoint[]): number {
  if (!route.length) {
    return 0;
  }

  let minDistance = Number.MAX_SAFE_INTEGER;
  for (const point of route) {
    const distance = getDistance(
      { latitude: current.lat, longitude: current.lng },
      { latitude: point.lat, longitude: point.lng }
    );

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

export function useGeofence({ expectedRoute, maxDeviationMeters = 200 }: UseGeofenceParams) {
  const [lastResult, setLastResult] = useState<GeoCheckResult>({ deviated: false, distance: 0 });

  const hasRoute = useMemo(() => expectedRoute.length > 0, [expectedRoute]);

  const evaluateGeofence = useCallback(
    (current: RoutePoint): GeoCheckResult => {
      if (!hasRoute) {
        const noRouteResult = { deviated: false, distance: 0 };
        setLastResult(noRouteResult);
        return noRouteResult;
      }

      const distance = minDistanceToRoute(current, expectedRoute);
      const result = {
        deviated: distance > maxDeviationMeters,
        distance,
      };

      setLastResult(result);
      return result;
    },
    [expectedRoute, hasRoute, maxDeviationMeters]
  );

  return {
    evaluateGeofence,
    geofenceState: lastResult,
  };
}
