#!/usr/bin/env python3
import subprocess
import sys
import os

# Ensure we use the correct Python environment
python_path = "/home/runner/workspace/.pythonlibs/bin/python3"

if __name__ == "__main__":
    try:
        # Run the Flask app directly
        subprocess.run([python_path, "app.py"], check=True)
    except KeyboardInterrupt:
        print("\nShutting down Flask application...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting Flask app: {e}")
        sys.exit(1)