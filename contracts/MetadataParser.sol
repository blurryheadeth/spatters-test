// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MetadataParser
 * @dev Library for parsing JSON metadata to extract mutation eligibility parameters
 * Extracts: circles count, lines count, and unique colors count
 */
library MetadataParser {
    /**
     * @dev Parse JSON metadata to extract eligibility parameters
     * Returns: (circlesCount, linesCount, uniqueColorsCount)
     * 
     * Note: This is a simplified parser. In production, metadata should be
     * structured or these values should be stored separately for gas efficiency.
     */
    function parseMetadata(string memory metadata) 
        internal 
        pure 
        returns (uint256 circles, uint256 lines, uint256 colors) 
    {
        // For MVP, we'll use a simplified parsing approach
        // In production, consider storing these values separately or using
        // a more robust JSON parsing library
        
        bytes memory metadataBytes = bytes(metadata);
        
        // Find "circles"
        circles = findNumberAfterKey(metadataBytes, "circles");
        
        // Find "lines"  
        lines = findNumberAfterKey(metadataBytes, "lines");
        
        // Find "selectedColors" array length (unique colors)
        colors = countUniqueColors(metadataBytes);
        
        return (circles, lines, colors);
    }
    
    /**
     * @dev Find a number value after a specific key in JSON
     */
    function findNumberAfterKey(bytes memory data, bytes memory key) 
        private 
        pure 
        returns (uint256) 
    {
        uint256 dataLen = data.length;
        uint256 keyLen = key.length;
        
        // Find the key
        for (uint256 i = 0; i < dataLen - keyLen; i++) {
            bool found = true;
            for (uint256 j = 0; j < keyLen; j++) {
                if (data[i + j] != key[j]) {
                    found = false;
                    break;
                }
            }
            
            if (found) {
                // Found the key, now find the number after ":"
                for (uint256 k = i + keyLen; k < dataLen; k++) {
                    if (data[k] >= 0x30 && data[k] <= 0x39) { // 0-9
                        // Found a digit, parse the number
                        uint256 num = 0;
                        while (k < dataLen && data[k] >= 0x30 && data[k] <= 0x39) {
                            num = num * 10 + uint256(uint8(data[k])) - 0x30;
                            k++;
                        }
                        return num;
                    }
                }
            }
        }
        
        return 0; // Not found
    }
    
    /**
     * @dev Count unique colors in selectedColors array
     * This is simplified - actual implementation would need to parse the full array
     */
    function countUniqueColors(bytes memory data) 
        private 
        pure 
        returns (uint256) 
    {
        // Look for "selectedColors" and count array elements
        // This is a simplified implementation
        bytes memory key = bytes("selectedColors");
        uint256 dataLen = data.length;
        uint256 keyLen = key.length;
        
        for (uint256 i = 0; i < dataLen - keyLen; i++) {
            bool found = true;
            for (uint256 j = 0; j < keyLen; j++) {
                if (data[i + j] != key[j]) {
                    found = false;
                    break;
                }
            }
            
            if (found) {
                // Count # symbols (hex color indicators)
                uint256 colorCount = 0;
                for (uint256 k = i; k < dataLen; k++) {
                    if (data[k] == 0x23) { // '#' character
                        colorCount++;
                    }
                    if (data[k] == 0x5D) { // ']' array end
                        break;
                    }
                }
                
                return colorCount;
            }
        }
        
        return 0;
    }
    
    /**
     * @dev Calculate eligibility month based on circles and lines
     * Formula: month = (circles * 3) + lines
     * Returns: 1-12 for Jan-Dec, with 0 mapped to 12 (December)
     */
    function calculateEligibilityMonth(uint256 circles, uint256 lines) 
        internal 
        pure 
        returns (uint256) 
    {
        uint256 month = (circles * 3) + lines;
        
        // 0 maps to December (12)
        if (month == 0) {
            return 12;
        }
        
        // Cap at 12
        if (month > 12) {
            return 12;
        }
        
        return month;
    }
    
    /**
     * @dev Determine equinox/solstice date based on unique colors count
     * Returns: (month, day) of astronomical event
     * 1 or 5 colors -> Spring Equinox (March 20)
     * 2 colors -> Summer Solstice (June 21)
     * 3 colors -> Fall Equinox (September 22)
     * 4 colors -> Winter Solstice (December 21)
     */
    function getQuarterEndDate(uint256 uniqueColors) 
        internal 
        pure 
        returns (uint256 month, uint256 day) 
    {
        if (uniqueColors == 1 || uniqueColors == 5) {
            return (3, 20); // Spring Equinox - March 20
        } else if (uniqueColors == 2) {
            return (6, 21); // Summer Solstice - June 21
        } else if (uniqueColors == 3) {
            return (9, 22); // Fall Equinox - September 22
        } else if (uniqueColors == 4) {
            return (12, 21); // Winter Solstice - December 21
        }
        
        // Default to no eligibility
        return (0, 0);
    }
}


