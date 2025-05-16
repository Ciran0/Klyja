#!/bin/bash

# Script to run all tests and generate combined coverage report
set -e  # Exit on any error

echo "Running backend unit tests..."
cd backend
cargo test

echo "Running WASM unit tests..."
cd ../geco
cargo test -- --lib

echo "Running frontend tests with coverage..."
cd ../frontend
npm test

echo "All tests completed!"
echo "Frontend coverage report available at: frontend/coverage/index.html"

# Print test summary
echo "Test Summary:"
echo "--------------"
echo "Backend tests: PASSED"
echo "WASM tests: PASSED"
echo "Frontend tests: PASSED"

# In the future, we could add functionality to combine coverage reports
# from different parts of the codebase using tools like codecov or coveralls