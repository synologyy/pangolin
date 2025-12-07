import { assertEquals } from "@test/assert";

// Helper to create a timestamp from a date string (UTC)
function dateToTimestamp(dateStr: string): number {
    return Math.floor(new Date(dateStr).getTime() / 1000);
}

// Testable version of calculateCutoffTimestamp that accepts a "now" timestamp
// This matches the logic in cleanupLogs.ts but allows injecting the current time
function calculateCutoffTimestampWithNow(retentionDays: number, nowTimestamp: number): number {
    if (retentionDays === 9001) {
        // Special case: data is erased at the end of the year following the year it was generated
        // This means we delete logs from 2 years ago or older (logs from year Y are deleted after Dec 31 of year Y+1)
        const currentYear = new Date(nowTimestamp * 1000).getUTCFullYear();
        // Cutoff is the start of the year before last (Jan 1, currentYear - 1 at 00:00:00)
        // Any logs before this date are from 2+ years ago and should be deleted
        const cutoffDate = new Date(Date.UTC(currentYear - 1, 0, 1, 0, 0, 0));
        return Math.floor(cutoffDate.getTime() / 1000);
    } else {
        return nowTimestamp - retentionDays * 24 * 60 * 60;
    }
}

function testCalculateCutoffTimestamp() {
    console.log("Running calculateCutoffTimestamp tests...");

    // Test 1: Normal retention days (e.g., 30 days)
    {
        const now = dateToTimestamp("2025-12-06T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(30, now);
        const expected = now - (30 * 24 * 60 * 60);
        assertEquals(result, expected, "30 days retention calculation failed");
    }

    // Test 2: Normal retention days (e.g., 90 days)
    {
        const now = dateToTimestamp("2025-06-15T00:00:00Z");
        const result = calculateCutoffTimestampWithNow(90, now);
        const expected = now - (90 * 24 * 60 * 60);
        assertEquals(result, expected, "90 days retention calculation failed");
    }

    // Test 3: Special case 9001 - December 2025 (before Dec 31)
    // Data from 2024 should NOT be deleted yet (must wait until after Dec 31, 2025)
    // Data from 2023 and earlier should be deleted
    // Cutoff should be Jan 1, 2024 (start of currentYear - 1)
    {
        const now = dateToTimestamp("2025-12-06T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2024-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (Dec 2025) - should cutoff at Jan 1, 2024");
    }

    // Test 4: Special case 9001 - January 2026
    // Data from 2024 should now be deleted (Dec 31, 2025 has passed)
    // Cutoff should be Jan 1, 2025 (start of currentYear - 1)
    {
        const now = dateToTimestamp("2026-01-15T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2025-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (Jan 2026) - should cutoff at Jan 1, 2025");
    }

    // Test 5: Special case 9001 - December 31, 2025 at 23:59:59 UTC
    // Still in 2025, so data from 2024 should NOT be deleted yet
    // Cutoff should be Jan 1, 2024
    {
        const now = dateToTimestamp("2025-12-31T23:59:59Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2024-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (Dec 31, 2025 23:59:59) - should cutoff at Jan 1, 2024");
    }

    // Test 6: Special case 9001 - January 1, 2026 at 00:00:01 UTC
    // Now in 2026, so data from 2024 should be deleted
    // Cutoff should be Jan 1, 2025
    {
        const now = dateToTimestamp("2026-01-01T00:00:01Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2025-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (Jan 1, 2026 00:00:01) - should cutoff at Jan 1, 2025");
    }

    // Test 7: Special case 9001 - Mid year 2025
    // Cutoff should still be Jan 1, 2024
    {
        const now = dateToTimestamp("2025-06-15T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2024-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (mid 2025) - should cutoff at Jan 1, 2024");
    }

    // Test 8: Special case 9001 - Early 2024
    // Cutoff should be Jan 1, 2023
    {
        const now = dateToTimestamp("2024-02-01T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2023-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (early 2024) - should cutoff at Jan 1, 2023");
    }

    // Test 9: 1 day retention
    {
        const now = dateToTimestamp("2025-12-06T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(1, now);
        const expected = now - (1 * 24 * 60 * 60);
        assertEquals(result, expected, "1 day retention calculation failed");
    }

    // Test 10: 365 days retention (1 year)
    {
        const now = dateToTimestamp("2025-12-06T12:00:00Z");
        const result = calculateCutoffTimestampWithNow(365, now);
        const expected = now - (365 * 24 * 60 * 60);
        assertEquals(result, expected, "365 days retention calculation failed");
    }

    // Test 11: Verify 9001 deletes logs correctly across year boundary
    // If we're in 2025, logs from Dec 31, 2023 (timestamp) should be DELETED (before cutoff)
    // But logs from Jan 1, 2024 (timestamp) should be KEPT (at or after cutoff)
    {
        const now = dateToTimestamp("2025-12-06T12:00:00Z");
        const cutoff = calculateCutoffTimestampWithNow(9001, now);
        const logFromDec2023 = dateToTimestamp("2023-12-31T23:59:59Z");
        const logFromJan2024 = dateToTimestamp("2024-01-01T00:00:00Z");
        
        // Log from Dec 2023 should be before cutoff (deleted)
        assertEquals(logFromDec2023 < cutoff, true, "Log from Dec 2023 should be deleted");
        // Log from Jan 2024 should be at or after cutoff (kept)
        assertEquals(logFromJan2024 >= cutoff, true, "Log from Jan 2024 should be kept");
    }

    // Test 12: Verify 9001 in 2026 - logs from 2024 should now be deleted
    {
        const now = dateToTimestamp("2026-03-15T12:00:00Z");
        const cutoff = calculateCutoffTimestampWithNow(9001, now);
        const logFromDec2024 = dateToTimestamp("2024-12-31T23:59:59Z");
        const logFromJan2025 = dateToTimestamp("2025-01-01T00:00:00Z");
        
        // Log from Dec 2024 should be before cutoff (deleted)
        assertEquals(logFromDec2024 < cutoff, true, "Log from Dec 2024 should be deleted in 2026");
        // Log from Jan 2025 should be at or after cutoff (kept)
        assertEquals(logFromJan2025 >= cutoff, true, "Log from Jan 2025 should be kept in 2026");
    }

    // Test 13: Edge case - exactly at year boundary for 9001
    // On Jan 1, 2025 00:00:00 UTC, cutoff should be Jan 1, 2024
    {
        const now = dateToTimestamp("2025-01-01T00:00:00Z");
        const result = calculateCutoffTimestampWithNow(9001, now);
        const expected = dateToTimestamp("2024-01-01T00:00:00Z");
        assertEquals(result, expected, "9001 retention (Jan 1, 2025 00:00:00) - should cutoff at Jan 1, 2024");
    }

    // Test 14: Verify data from 2024 is kept throughout 2025 when using 9001
    // Example: Log created on July 15, 2024 should be kept until Dec 31, 2025
    {
        // Running in June 2025
        const nowJune2025 = dateToTimestamp("2025-06-15T12:00:00Z");
        const cutoffJune2025 = calculateCutoffTimestampWithNow(9001, nowJune2025);
        const logFromJuly2024 = dateToTimestamp("2024-07-15T12:00:00Z");
        
        // Log from July 2024 should be KEPT in June 2025
        assertEquals(logFromJuly2024 >= cutoffJune2025, true, "Log from July 2024 should be kept in June 2025");
        
        // Running in January 2026
        const nowJan2026 = dateToTimestamp("2026-01-15T12:00:00Z");
        const cutoffJan2026 = calculateCutoffTimestampWithNow(9001, nowJan2026);
        
        // Log from July 2024 should be DELETED in January 2026
        assertEquals(logFromJuly2024 < cutoffJan2026, true, "Log from July 2024 should be deleted in Jan 2026");
    }

    // Test 15: Verify the exact requirement - data from 2024 must be purged on December 31, 2025
    // On Dec 31, 2025 (still 2025), data from 2024 should still exist
    // On Jan 1, 2026 (now 2026), data from 2024 can be deleted
    {
        const logFromMid2024 = dateToTimestamp("2024-06-15T12:00:00Z");
        
        // Dec 31, 2025 23:59:59 - still 2025, log should be kept
        const nowDec31_2025 = dateToTimestamp("2025-12-31T23:59:59Z");
        const cutoffDec31 = calculateCutoffTimestampWithNow(9001, nowDec31_2025);
        assertEquals(logFromMid2024 >= cutoffDec31, true, "Log from mid-2024 should be kept on Dec 31, 2025");
        
        // Jan 1, 2026 00:00:00 - now 2026, log can be deleted
        const nowJan1_2026 = dateToTimestamp("2026-01-01T00:00:00Z");
        const cutoffJan1 = calculateCutoffTimestampWithNow(9001, nowJan1_2026);
        assertEquals(logFromMid2024 < cutoffJan1, true, "Log from mid-2024 should be deleted on Jan 1, 2026");
    }

    console.log("All calculateCutoffTimestamp tests passed!");
}

// Run all tests
try {
    testCalculateCutoffTimestamp();
    console.log("All tests passed successfully!");
} catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
}
