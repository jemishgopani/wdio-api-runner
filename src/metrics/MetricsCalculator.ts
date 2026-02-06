/**
 * Metrics Calculator
 *
 * Statistical functions for calculating percentiles, averages, and other metrics.
 */

import type { MetricEntry, PercentileStats, EndpointMetrics } from './types.js'
import { EMPTY_PERCENTILE_STATS, DEFAULT_PERCENTILES } from './constants.js'

/**
 * Calculate a specific percentile from a sorted array of numbers
 *
 * Uses linear interpolation for more accurate percentile calculation.
 *
 * @param sortedValues - Pre-sorted array of numbers (ascending)
 * @param percentile - Percentile to calculate (0-100)
 * @returns The calculated percentile value
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
        return 0
    }

    if (sortedValues.length === 1) {
        return sortedValues[0]
    }

    // Convert percentile to a rank (0-based index with interpolation)
    const rank = (percentile / 100) * (sortedValues.length - 1)
    const lowerIndex = Math.floor(rank)
    const upperIndex = Math.ceil(rank)

    // If exact index, return that value
    if (lowerIndex === upperIndex) {
        return sortedValues[lowerIndex]
    }

    // Linear interpolation between the two nearest values
    const fraction = rank - lowerIndex
    const lowerValue = sortedValues[lowerIndex]
    const upperValue = sortedValues[upperIndex]

    return lowerValue + (upperValue - lowerValue) * fraction
}

/**
 * Calculate comprehensive statistics for an array of duration values
 *
 * @param durations - Array of duration values in milliseconds
 * @param percentiles - Which percentiles to calculate (default: [50, 95, 99])
 * @returns PercentileStats object with all calculated values
 */
export function calculateStats(
    durations: number[],
    percentiles: readonly number[] = DEFAULT_PERCENTILES
): PercentileStats {
    if (durations.length === 0) {
        return { ...EMPTY_PERCENTILE_STATS }
    }

    // Sort for percentile calculation
    const sorted = [...durations].sort((a, b) => a - b)

    const sum = durations.reduce((acc, val) => acc + val, 0)
    const avg = sum / durations.length

    // Calculate requested percentiles
    const p50 = percentiles.includes(50) ? calculatePercentile(sorted, 50) : 0
    const p95 = percentiles.includes(95) ? calculatePercentile(sorted, 95) : 0
    const p99 = percentiles.includes(99) ? calculatePercentile(sorted, 99) : 0

    return {
        p50: Math.round(p50 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: Math.round(avg * 100) / 100,
        count: durations.length,
        sum: Math.round(sum * 100) / 100,
    }
}

/**
 * Calculate statistics from metric entries
 *
 * @param entries - Array of MetricEntry objects
 * @param percentiles - Which percentiles to calculate
 * @returns PercentileStats object
 */
export function calculateStatsFromEntries(
    entries: MetricEntry[],
    percentiles: readonly number[] = DEFAULT_PERCENTILES
): PercentileStats {
    const durations = entries.map((e) => e.duration)
    return calculateStats(durations, percentiles)
}

/**
 * Group metric entries by endpoint
 *
 * @param entries - Array of MetricEntry objects
 * @returns Map of endpoint -> entries
 */
export function groupByEndpoint(entries: MetricEntry[]): Map<string, MetricEntry[]> {
    const groups = new Map<string, MetricEntry[]>()

    for (const entry of entries) {
        const key = `${entry.method} ${entry.endpoint}`
        const existing = groups.get(key) || []
        existing.push(entry)
        groups.set(key, existing)
    }

    return groups
}

/**
 * Group metric entries by HTTP method
 *
 * @param entries - Array of MetricEntry objects
 * @returns Map of method -> entries
 */
export function groupByMethod(entries: MetricEntry[]): Map<string, MetricEntry[]> {
    const groups = new Map<string, MetricEntry[]>()

    for (const entry of entries) {
        const existing = groups.get(entry.method) || []
        existing.push(entry)
        groups.set(entry.method, existing)
    }

    return groups
}

/**
 * Calculate endpoint-level metrics
 *
 * @param entries - Array of MetricEntry objects
 * @param percentiles - Which percentiles to calculate
 * @returns Array of EndpointMetrics
 */
export function calculateEndpointMetrics(
    entries: MetricEntry[],
    percentiles: readonly number[] = DEFAULT_PERCENTILES
): EndpointMetrics[] {
    const groups = groupByEndpoint(entries)
    const results: EndpointMetrics[] = []

    for (const [key, groupEntries] of groups) {
        const [method, ...endpointParts] = key.split(' ')
        const endpoint = endpointParts.join(' ')

        const successCount = groupEntries.filter((e) => e.success).length
        const errorCount = groupEntries.length - successCount
        const successRate = (successCount / groupEntries.length) * 100

        results.push({
            endpoint,
            method,
            stats: calculateStatsFromEntries(groupEntries, percentiles),
            successRate: Math.round(successRate * 100) / 100,
            errorCount,
        })
    }

    // Sort by total requests (descending)
    return results.sort((a, b) => b.stats.count - a.stats.count)
}

/**
 * Calculate method-level statistics
 *
 * @param entries - Array of MetricEntry objects
 * @param percentiles - Which percentiles to calculate
 * @returns Record of method -> PercentileStats
 */
export function calculateMethodStats(
    entries: MetricEntry[],
    percentiles: readonly number[] = DEFAULT_PERCENTILES
): Record<string, PercentileStats> {
    const groups = groupByMethod(entries)
    const results: Record<string, PercentileStats> = {}

    for (const [method, groupEntries] of groups) {
        results[method] = calculateStatsFromEntries(groupEntries, percentiles)
    }

    return results
}

/**
 * Get the slowest requests
 *
 * @param entries - Array of MetricEntry objects
 * @param count - Number of entries to return
 * @param threshold - Optional minimum duration threshold
 * @returns Array of slowest MetricEntry objects
 */
export function getSlowestRequests(entries: MetricEntry[], count: number, threshold?: number): MetricEntry[] {
    let filtered = entries

    if (threshold !== undefined) {
        filtered = entries.filter((e) => e.duration >= threshold)
    }

    return [...filtered].sort((a, b) => b.duration - a.duration).slice(0, count)
}

/**
 * Get failed requests
 *
 * @param entries - Array of MetricEntry objects
 * @param count - Number of entries to return
 * @returns Array of failed MetricEntry objects
 */
export function getFailedRequests(entries: MetricEntry[], count: number): MetricEntry[] {
    return entries
        .filter((e) => !e.success)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, count)
}
