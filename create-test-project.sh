#!/bin/bash

# Clean and create test directory
rm -rf test-project
mkdir -p test-project
cd test-project

# Initialize npm project
npm init -y

# Create test files
mkdir public
touch index.html
touch index.js

# Add type module to package.json
node -e "const p=require('./package.json'); p.type='module'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2))"

# Install local paulstretch package
npm install ../