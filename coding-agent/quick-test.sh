#!/bin/bash
cd /Users/dbl/Code/agent-orchestrator/coding-agent
echo "Starting agent..."
echo ""
echo "Test: create a simple test.txt file"
echo ""
echo "create a simple test.txt file with 'Testing 123' in it" | npm run dev start -- --agent main-coder
