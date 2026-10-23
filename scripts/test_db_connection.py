"""
Database Connection Verification Script
Tests MySQL connectivity without exposing credentials or executing destructive queries.
"""
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.core.config import settings
from backend.app.db.session import check_db_connection

def main():
    print("=" * 60)
    print("EduVault - MySQL Database Connection Diagnostic Tool")
    print("=" * 60)
    print(f"Target Host     : {settings.MYSQL_HOST}:{settings.MYSQL_PORT}")
    print(f"Target Database : {settings.MYSQL_DATABASE}")
    print(f"Target User     : {settings.MYSQL_USER}")
    print("-" * 60)
    print("Testing connection...")
    
    result = check_db_connection()
    
    if result.get("status") == "connected":
        print("[SUCCESS] MySQL server is ONLINE and accepting connections!")
        print(f"Details: {result}")
        sys.exit(0)
    else:
        print("[BLOCKED / DISCONNECTED] Unable to reach MySQL server.")
        print(f"Reason: {result.get('error')}")
        print("\nTroubleshooting Steps for Developer:")
        print("1. Ensure MySQL Server service is started (e.g., in Windows Services: 'net start MySQL80' or via XAMPP/Laragon).")
        print("2. Check credentials in '.env' or environment variables (MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).")
        print("3. Ensure the database 'equipment_lending_db' exists:")
        print("   CREATE DATABASE IF NOT EXISTS equipment_lending_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
