#!/bin/bash

# MCP GDB Server Installer Script

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BUILD_DIR="$SCRIPT_DIR/dist"
GDB_PATH=$(which gdb 2>/dev/null || echo "")

echo "MCP GDB Server Installer"
echo "========================"
echo

# Check if GDB is installed
if [ -z "$GDB_PATH" ]; then
    echo "⚠️ Warning: GDB is not found in your PATH. You need to install GDB before using this MCP server."
    echo "On Ubuntu/Debian: sudo apt-get install gdb"
    echo "On Fedora/RHEL: sudo dnf install gdb"
    echo "On Arch Linux: sudo pacman -S gdb"
    echo "On macOS: brew install gdb"
    echo
    read -p "Do you want to continue with the installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building the MCP GDB server..."
npm run build

# Get the absolute path to the build directory
ABSOLUTE_PATH=$(cd "$BUILD_DIR" && pwd)

# Generate MCP settings configuration snippet
echo
echo "MCP GDB Server has been built successfully!"
echo
echo "To use it with Claude or other MCP-enabled assistants, add the following to your MCP settings configuration:"
echo
echo "{" 
echo "  \"mcpServers\": {"
echo "    \"gdb\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$ABSOLUTE_PATH/index.js\"],"
echo "      \"disabled\": false"
echo "    }"
echo "  }"
echo "}"
echo
echo "For Claude Desktop, this file is typically located at:"
echo "- Linux: ~/.config/Claude/claude_desktop_config.json"
echo "- macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "- Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
echo
echo "For Claude in VSCode, this file is typically located at:"
echo "- Linux: ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
echo "- macOS: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
echo "- Windows: %APPDATA%\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json"
echo
echo "After adding the configuration, restart Claude or reload the extension for the changes to take effect."
echo
echo "To test the MCP GDB server, compile and debug the example program:"
echo "  cd examples"
echo "  gcc -g crash.c -o crash"
echo
echo "Then follow the instructions in examples/USAGE.md to debug the program using Claude."
echo

# Create example directory and compile the example file
if [ -d "$SCRIPT_DIR/examples" ]; then
    echo "Would you like to compile the example program now? (y/n) "
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$SCRIPT_DIR/examples"
        echo "Compiling example program..."
        gcc -g crash.c -o crash
        echo "Example program compiled successfully!"
    fi
fi

echo "Installation complete!"
