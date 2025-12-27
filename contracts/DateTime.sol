// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DateTime
 * @dev Library for date and time calculations
 * Handles month/day extraction for mutation eligibility
 */
library DateTime {
    uint256 constant SECONDS_PER_DAY = 24 * 60 * 60;
    
    struct DateTime {
        uint256 year;
        uint256 month;
        uint256 day;
    }
    
    /**
     * @dev Parse Unix timestamp into year/month/day
     */
    function parseTimestamp(uint256 timestamp) 
        internal 
        pure 
        returns (DateTime memory) 
    {
        uint256 daysSinceEpoch = timestamp / SECONDS_PER_DAY;
        
        // Calculate year (starting from 1970)
        uint256 year = 1970;
        uint256 daysInYear;
        
        while (true) {
            daysInYear = isLeapYear(year) ? 366 : 365;
            if (daysSinceEpoch >= daysInYear) {
                daysSinceEpoch -= daysInYear;
                year++;
            } else {
                break;
            }
        }
        
        // Calculate month and day
        uint256 month = 1;
        uint256 day;
        
        for (month = 1; month <= 12; month++) {
            uint256 daysInMonth = getDaysInMonth(month, year);
            if (daysSinceEpoch >= daysInMonth) {
                daysSinceEpoch -= daysInMonth;
            } else {
                day = daysSinceEpoch + 1; // Days are 1-indexed
                break;
            }
        }
        
        return DateTime(year, month, day);
    }
    
    /**
     * @dev Check if a year is a leap year
     */
    function isLeapYear(uint256 year) internal pure returns (bool) {
        if (year % 4 != 0) {
            return false;
        }
        if (year % 100 != 0) {
            return true;
        }
        if (year % 400 != 0) {
            return false;
        }
        return true;
    }
    
    /**
     * @dev Get number of days in a month
     */
    function getDaysInMonth(uint256 month, uint256 year) 
        internal 
        pure 
        returns (uint256) 
    {
        if (month == 1 || month == 3 || month == 5 || month == 7 || 
            month == 8 || month == 10 || month == 12) {
            return 31;
        }
        if (month == 4 || month == 6 || month == 9 || month == 11) {
            return 30;
        }
        if (month == 2) {
            return isLeapYear(year) ? 29 : 28;
        }
        return 0;
    }
}
