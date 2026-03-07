import json
from typing import List, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class LocationService:
    def __init__(self):
        self.location_data = None
        self._load_location_data()

    def _load_location_data(self):
        """Load location data from JSON file"""
        try:
            # Path to the location data file
            json_path = Path(__file__).parent.parent.parent / "resources" / "telangana_all_villages.json"
            
            with open(json_path, 'r', encoding='utf-8') as f:
                self.location_data = json.load(f)
            
            logger.info("Location data loaded successfully")
        except Exception as e:
            logger.error(f"Error loading location data: {e}")
            self.location_data = {}

    def get_states(self) -> List[str]:
        """Get list of states"""
        if not self.location_data:
            return []
        return list(self.location_data.keys())

    def get_districts(self, state: str) -> List[str]:
        """Get list of districts for a state"""
        if not self.location_data or state not in self.location_data:
            return []
        
        state_data = self.location_data[state]
        return list(state_data.keys())

    def get_mandals(self, state: str, district: str) -> List[str]:
        """Get list of mandals for a district"""
        if not self.location_data or state not in self.location_data:
            return []
        
        state_data = self.location_data[state]
        if district not in state_data:
            return []
        
        district_data = state_data[district]
        return list(district_data.keys())

    def get_villages(self, state: str, district: str, mandal: str) -> List[str]:
        """Get list of villages for a mandal"""
        if not self.location_data or state not in self.location_data:
            return []
        
        state_data = self.location_data[state]
        if district not in state_data:
            return []
        
        district_data = state_data[district]
        if mandal not in district_data:
            return []
        
        return district_data[mandal]

    def validate_location(self, state: str, district: str = None, 
                         mandal: str = None, village: str = None) -> bool:
        """Validate if location hierarchy is correct"""
        if not self.location_data or state not in self.location_data:
            return False
        
        if district:
            state_data = self.location_data[state]
            if district not in state_data:
                return False
            
            if mandal:
                district_data = state_data[district]
                if mandal not in district_data:
                    return False
                
                if village:
                    villages = district_data[mandal]
                    if village not in villages:
                        return False
        
        return True

    def get_location_hierarchy(self, state: str, district: str = None, 
                              mandal: str = None) -> Dict[str, Any]:
        """Get complete location hierarchy"""
        result = {
            "state": state,
            "districts": []
        }
        
        if not self.location_data or state not in self.location_data:
            return result
        
        state_data = self.location_data[state]
        
        if district:
            if district in state_data:
                result["district"] = district
                result["mandals"] = []
                
                district_data = state_data[district]
                
                if mandal:
                    if mandal in district_data:
                        result["mandal"] = mandal
                        result["villages"] = district_data[mandal]
                else:
                    result["mandals"] = list(district_data.keys())
        else:
            result["districts"] = list(state_data.keys())
        
        return result


# Global location service instance
location_service = LocationService()
