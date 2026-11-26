"""Deterministic geographic coordinates for Gujarat districts and talukas."""

import hashlib
from typing import Dict, Tuple

DISTRICT_COORDINATES: Dict[str, Tuple[float, float]] = {
    "Ahmedabad": (23.0225, 72.5714),
    "Surat": (21.1702, 72.8311),
    "Vadodara": (22.3072, 73.1812),
    "Rajkot": (22.3039, 70.8022),
    "Mehsana": (23.5880, 72.3693),
    "Bhavnagar": (21.7645, 72.1519),
    "Jamnagar": (22.4707, 70.0577),
    "Gandhinagar": (23.2156, 72.6369),
}

TALUKA_COORDINATES: Dict[str, Tuple[float, float]] = {
    # Ahmedabad
    "Ahmedabad City": (23.0225, 72.5714),
    "Daskroi": (22.9500, 72.6300),
    "Sanand": (22.9927, 72.3812),
    "Bavla": (22.8340, 72.3610),
    "Dholka": (22.7196, 72.4410),
    "Dhandhuka": (22.3670, 71.9830),
    "Dholera": (22.2460, 72.1930),
    "Viramgam": (23.1250, 72.0350),
    "Mandal": (23.2840, 71.9160),
    "Detroj-Rampura": (23.3370, 72.1880),
    # Surat
    "Surat City": (21.1702, 72.8311),
    "Choryasi": (21.1400, 72.7600),
    "Olpad": (21.3330, 72.7530),
    "Kamrej": (21.2720, 72.9600),
    "Palsana": (21.0830, 72.9700),
    "Bardoli": (21.1180, 73.1130),
    "Mandvi": (21.2600, 73.3000),
    "Mahuva": (20.9570, 73.1550),
    "Mangrol": (21.5450, 73.1000),
    "Umarpada": (21.5000, 73.4000),
    # Vadodara
    "Vadodara": (22.3072, 73.1812),
    "Padra": (22.2380, 73.0800),
    "Karjan": (22.0570, 73.1200),
    "Waghodia": (22.3000, 73.4200),
    "Dabhoi": (22.1330, 73.4330),
    "Savli": (22.5600, 73.2200),
    "Shinor": (21.9100, 73.3400),
    "Desar": (22.6000, 73.3800),
    # Rajkot
    "Rajkot": (22.3039, 70.8022),
    "Gondal": (21.9619, 70.7925),
    "Jetpur": (21.7540, 70.6230),
    "Dhoraji": (21.7340, 70.4490),
    "Upleta": (21.7370, 70.2820),
    "Jasdan": (22.0330, 71.2000),
    "Paddhari": (22.4330, 70.6000),
    "Lodhika": (22.1600, 70.7100),
    "Kotda Sangani": (21.9330, 70.9330),
    "Jamkandorna": (21.8000, 70.4500),
    "Vinchhiya": (22.1100, 71.3500),
    # Mehsana
    "Mehsana": (23.5880, 72.3693),
    "Kadi": (23.3000, 72.3300),
    "Visnagar": (23.7000, 72.5500),
    "Unjha": (23.8000, 72.3900),
    "Vadnagar": (23.7800, 72.6300),
    "Kheralu": (23.8800, 72.6200),
    "Vijapur": (23.5600, 72.7500),
    "Becharaji": (23.5000, 72.0400),
    "Satlasana": (23.9800, 72.7500),
    "Jotana": (23.4700, 72.3300),
    # Bhavnagar
    "Bhavnagar": (21.7645, 72.1519),
    "Sihor": (21.7000, 71.9700),
    "Umrala": (21.8200, 71.8000),
    "Gariadhar": (21.5300, 71.5800),
    "Palitana": (21.5200, 71.8300),
    "Talaja": (21.3500, 72.0400),
    "Ghogha": (21.6800, 72.2800),
    "Jesar": (21.3800, 71.7900),
    "Vallabhipur": (21.8800, 71.8800),
    # Jamnagar
    "Jamnagar": (22.4707, 70.0577),
    "Jodiya": (22.7000, 70.3000),
    "Dhrol": (22.5600, 70.4100),
    "Kalavad": (22.2100, 70.3800),
    "Lalpur": (22.1800, 69.9600),
    "Jamjodhpur": (21.9000, 69.9800),
    # Gandhinagar
    "Gandhinagar": (23.2156, 72.6369),
    "Kalol": (23.2400, 72.4900),
    "Dehgam": (23.1600, 72.8100),
    "Mansa": (23.4300, 72.6600),
}


def get_shop_coordinates(shop_id: str, district: str, taluka: str) -> Tuple[float, float]:
    """Returns deterministic realistic lat/lng inside the taluka for a shop."""
    base = TALUKA_COORDINATES.get(taluka) or DISTRICT_COORDINATES.get(district, (22.8000, 71.8000))
    h = int(hashlib.md5(shop_id.encode()).hexdigest(), 16)
    jitter_lat = ((h % 1000) - 500) / 15000.0  # approx +/- 2.5-3.5 km
    jitter_lng = (((h // 1000) % 1000) - 500) / 15000.0
    return round(base[0] + jitter_lat, 5), round(base[1] + jitter_lng, 5)
