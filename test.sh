#!/bin/bash

# Clean previous builds
rm -rf dist
rm -rf node_modules
rm -rf test-project

# Fresh install
npm install

# Run tests
NODE_OPTIONS="--experimental-vm-modules --experimental-specifier-resolution=node" npm test

# # Build package
# NODE_OPTIONS="--experimental-vm-modules" npm run build

# # Create test project
# mkdir -p test-project
# cd test-project
# npm init -y

# # Create test file
# cat > index.js << 'EOL'
# import PaulStretch from '../dist/paulstretch.js';

# async function test() {
#     try {
#         const ps = new PaulStretch();
#         console.log('PaulStretch initialized successfully');
#     } catch (error) {
#         console.error('Error:', error);
#     }
# }

# test();
# EOL

# # Add type module to package.json
# node -e "const p=require('./package.json'); p.type='module'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2))"

# # Run test
# node index.js