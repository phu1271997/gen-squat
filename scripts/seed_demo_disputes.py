#!/usr/bin/env python3
import sys
import subprocess
import os

def main():
    print("GenSquat Seeding Utility Wrapper")
    
    # Path to javascript seed script
    js_script = os.path.join(os.path.dirname(__file__), "seed_demo_disputes.js")
    
    # Ensure node is installed and package dependencies exist
    try:
        subprocess.run(["node", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        print("Error: Node.js is required to execute the seed script client connection.")
        sys.exit(1)
        
    cmd = ["node", js_script] + sys.argv[1:]
    
    try:
        # Forward execution to Javascript SDK runner
        result = subprocess.run(cmd, check=True)
        sys.exit(result.returncode)
    except subprocess.CalledProcessError as e:
        print(f"Seeding execution failed with exit code: {e.returncode}")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
