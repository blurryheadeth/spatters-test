// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ExponentialPricing
 * @dev Library for calculating exponential pricing curve
 * Formula: price = 0.00618 * ((100/0.00618)^((n-25)/(999-25)))
 */
library ExponentialPricing {
    uint256 private constant PRECISION = 1e18;
    uint256 private constant START_PRICE = 0.00618 ether;  // 6180000000000000 wei
    uint256 private constant END_PRICE = 100 ether;
    uint256 private constant RESERVE = 25;
    uint256 private constant MAX_SUPPLY = 999;
    uint256 private constant RANGE = MAX_SUPPLY - RESERVE; // 974
    
    /**
     * @dev Calculate price for token at position n
     * Uses natural logarithm approximation for exponential curve
     */
    function calculatePrice(uint256 n) internal pure returns (uint256) {
        if (n <= RESERVE) {
            return 0;
        }
        
        // Position in the exponential curve (0 at token 26, 974 at token 999)
        uint256 position = n - RESERVE;
        
        if (position == 0) {
            return START_PRICE;
        }
        
        if (position >= RANGE) {
            return END_PRICE;
        }
        
        // Calculate: START_PRICE * ((END_PRICE/START_PRICE)^(position/RANGE))
        // = START_PRICE * (16181.229...^(position/974))
        
        // Using logarithm:
        // result = exp(ln(START_PRICE) + (position/RANGE) * ln(END_PRICE/START_PRICE))
        
        // ln(END_PRICE/START_PRICE) = ln(100/0.00618) = ln(16181.229) ≈ 9.691
        // Scaled by PRECISION: 9.691 * 1e18
        int256 lnRatio = 9691000000000000000; // ln(16181.229) * 1e18
        
        // (position/RANGE) * lnRatio
        int256 exponent = (int256(position) * lnRatio) / int256(RANGE);
        
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
        for (uint256 i = 1; i <= 20; i++) {
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


