import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { lookupZipCode as staticLookup, getCitiesForState as staticGetCities } from "./geoData";

export function useZipCodeLookup() {
  const queryClient = useQueryClient();

  const { data: dbZipCodes = [] } = useQuery({
    queryKey: ["zipCodes"],
    queryFn: async () => {
      try {
        return await base44.entities.ZipCode.list();
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  const dbLookupMap = useMemo(() => {
    const map = {};
    for (const zc of dbZipCodes) {
      if (zc.zip_code && zc.city) {
        const key = `${zc.country || ""}:${zc.zip_code}`;
        if (!map[key]) {
          map[key] = { city: zc.city, state: zc.state };
        }
      }
    }
    return map;
  }, [dbZipCodes]);

  const dbCitiesByState = useMemo(() => {
    const map = {};
    for (const zc of dbZipCodes) {
      if (zc.state && zc.city) {
        if (!map[zc.state]) map[zc.state] = [];
        if (!map[zc.state].includes(zc.city)) {
          map[zc.state].push(zc.city);
        }
      }
    }
    return map;
  }, [dbZipCodes]);

  const lookupZip = (zip, country) => {
    if (!zip || zip.length < 3) return null;
    const dbKey = `${country || ""}:${zip}`;
    if (dbLookupMap[dbKey]) return dbLookupMap[dbKey];
    if (country === "US") return staticLookup(zip);
    return null;
  };

  const getCitiesForState = (stateCode) => {
    const staticList = staticGetCities(stateCode);
    const dbList = dbCitiesByState[stateCode] || [];
    return [...new Set([...staticList, ...dbList])];
  };

  const saveZipMapping = async (zip, city, state, country) => {
    if (!zip || !city || !country) return;
    if (country === "US") {
      const staticResult = staticLookup(zip);
      if (staticResult && staticResult.city === city) return;
    }
    const existing = dbLookupMap[`${country}:${zip}`];
    if (existing && existing.city === city) return;
    try {
      await base44.entities.ZipCode.create({ zip_code: zip, city, state, country });
      queryClient.invalidateQueries({ queryKey: ["zipCodes"] });
    } catch {
      // Silently fail — non-critical
    }
  };

  // Async postal-code → city/state lookup that works for ANY country via the
  // geocodeLocations backend (Nominatim postalcode search). Falls back to the
  // static US prefix table + the ZipCode entity for instant local hits first.
  const lookupPostalAsync = async (zip, country) => {
    if (!zip || zip.length < 3 || !country) return null;
    // Instant local lookups first (static US table + DB).
    const local = lookupZip(zip, country);
    if (local) return local;
    try {
      const resp = await base44.functions.invoke("geocodeLocations", {
        postalLookup: { postalCode: zip, countryCode: country },
      });
      const data = resp?.data ?? resp ?? {};
      return data.postalResult || null;
    } catch {
      return null;
    }
  };

  // Async city typeahead within a state/country via the geocodeLocations
  // backend (Nominatim structured city search). Returns matching city names.
  const searchCitiesAsync = async (query, stateName, country) => {
    if (!query || query.trim().length < 2 || !country) return [];
    try {
      const resp = await base44.functions.invoke("geocodeLocations", {
        citySearch: { query, stateName, countryCode: country },
      });
      const data = resp?.data ?? resp ?? {};
      return data.cityResults || [];
    } catch {
      return [];
    }
  };

  return { lookupZip, getCitiesForState, saveZipMapping, lookupPostalAsync, searchCitiesAsync };
}