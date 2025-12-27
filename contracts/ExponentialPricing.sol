// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ExponentialPricing
 * @dev Library for calculating exponential pricing curve
 * Formula: price = 0.00618 * ((100/0.00618)^((n-25)/974))
 * 
 * The curve is FIXED and independent of ownerReserve:
 * - CURVE_START (25) defines where the exponential curve begins
 * - ownerReserve (passed from Spatters.sol) defines which tokens are free
 * - This separation allows changing the reserve without affecting the pricing curve
 */
library ExponentialPricing {
    uint256 private constant PRECISION = 1e18;
    uint256 private constant START_PRICE = 0.00618 ether;  // 6180000000000000 wei
    uint256 private constant END_PRICE = 100 ether;
    
    // Fixed curve parameters (independent of ownerReserve)
    uint256 private constant CURVE_START = 25;             // Where exponential curve begins
    uint256 private constant MAX_SUPPLY = 999;
    uint256 private constant CURVE_RANGE = MAX_SUPPLY - CURVE_START; // 974
    
    /**
     * @dev Calculate price for token at position n
     * @param n Token position (1-indexed)
     * @param ownerReserve Number of tokens reserved for owner (free mints)
     * Uses natural logarithm approximation for exponential curve
     */
    function calculatePrice(uint256 n, uint256 ownerReserve) internal pure returns (uint256) {
        // Tokens up to ownerReserve are free
        if (n <= ownerReserve) {
            return 0;
        }
        
        // Position in the exponential curve (relative to CURVE_START, not OWNER_RESERVE)
        // Token 31: position = 31 - 25 = 6
        // Token 999: position = 999 - 25 = 974
        uint256 position = n - CURVE_START;
        
        if (position == 0) {
            return START_PRICE;
        }
        
        if (position >= CURVE_RANGE) {
            return END_PRICE;
        }
        
        // Calculate: START_PRICE * ((END_PRICE/START_PRICE)^(position/CURVE_RANGE))
        // = START_PRICE * (16181.229...^(position/974))
        
        // Using logarithm:
        // result = START_PRICE * exp(ln(END_PRICE/START_PRICE) * (position/CURVE_RANGE))
        
        // ln(END_PRICE/START_PRICE) = ln(100/0.00618) = ln(16181.229) ≈ 9.691
        // Scaled by PRECISION: 9.691 * 1e18
        int256 lnRatio = 9691607193500630000; // ln(16181.229) * 1e18
        
        // (position/CURVE_RANGE) * lnRatio
        int256 exponent = (int256(position) * lnRatio) / int256(CURVE_RANGE);
        
        // exp(exponent) using Taylor series
        uint256 expResult = exp(exponent);
        
        // Multiply by START_PRICE
        return (START_PRICE * expResult) / PRECISION;
    }
    
    /**
     * @dev Exponential function using Taylor series
     * exp(x) = 1 + x + x^2/2! + x^3/3! + ...
     * x is scaled by PRECISION (1e18)
     */
    function exp(int256 x) private pure returns (uint256) {
        require(x < 135305999368893231589, "exp overflow"); // max safe value
        
        if (x < 0) {
            // exp(-x) = 1/exp(x)
            return (PRECISION * PRECISION) / exp(-x);
        }
        
        uint256 result = PRECISION;
        uint256 term = PRECISION;
        
        // Taylor series expansion
        for (uint256 i = 1; i <= 30; i++) {
            term = (term * uint256(x)) / (i * PRECISION);
            result += term;
            
            // Stop when term becomes negligible
            if (term < 100) {
                break;
            }
        }
        
        return result;
    }
}


