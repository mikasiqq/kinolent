"""Тест POST /api/schedule/generate-full через httpx."""
import httpx
import json

resp = httpx.post(
    "http://localhost:8000/api/schedule/generate-full",
    json={
        "config": {
            "scheduleName": "Integration Test",
            "days": 1,
            "halls": [
                {"id": "h1", "name": "Зал 1", "capacity": 200, "hallType": "2D",
                 "cleaningMinutes": 15, "openTime": "09:00", "closeTime": "23:00", "enabled": True},
                {"id": "h2", "name": "Зал 2", "capacity": 150, "hallType": "IMAX",
                 "cleaningMinutes": 20, "openTime": "10:00", "closeTime": "23:00", "enabled": True},
                {"id": "h3", "name": "Зал 3", "capacity": 100, "hallType": "2D",
                 "cleaningMinutes": 15, "openTime": "09:00", "closeTime": "23:00", "enabled": True},
            ],
            "staggerMinutes": 10,
            "maxColumnsPerIteration": 50,
            "lpTimeLimitSeconds": 10,
            "antiCrowding": True,
            "childrenDaytimeOnly": True,
        },
    },
    timeout=120,
)

print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"Schedule: {data['name']}")
    print(f"Total shows: {data['totalShows']}")
    print(f"Total revenue: {data['totalRevenue']}")
    print(f"Total attendance: {data['totalAttendance']}")
    print(f"Gap: {data['metrics']['gapPct']}%")
    print(f"Generation time: {data['metrics']['generationTimeMs']:.0f}ms")
    print(f"Hall schedules: {len(data['hallSchedules'])}")
    if data["qualityReport"]:
        qr = data["qualityReport"]
        print(f"Movie switches: {qr['totalMovieSwitches']}")
        print(f"Stagger violations: {qr['staggerViolations']}")
    # Print first few shows
    for hs in data["hallSchedules"][:2]:
        print(f"\n  {hs['hallName']} (day {hs['day']}): {len(hs['shows'])} shows")
        for show in hs["shows"][:3]:
            print(f"    {show['movieTitle']} | {show['startMinutes']//60}:{show['startMinutes']%60:02d}-{show['endMinutes']//60}:{show['endMinutes']%60:02d} | {show['predictedAttendance']} зрит")
    print("\nALL OK!")
else:
    print(f"Error: {resp.text}")
