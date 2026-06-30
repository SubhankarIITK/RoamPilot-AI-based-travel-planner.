/**
 * @typedef {Object} PlanV2
 * @property {2} schemaVersion
 * @property {string} generatedAt - ISO-8601
 * @property {number} workflowVersion
 * @property {string} tripTitle
 * @property {string} summary
 * @property {string[]} destinations
 * @property {Object[]} route
 * @property {string[]} dayThemes
 * @property {string[]} nonNegotiableConstraints
 * @property {Object[]} budgetBreakdown
 * @property {Object} budgetSummary
 * @property {Object[]} dailySpendingTargets
 * @property {Object[]} transportStrategy
 * @property {Object[]} flightSuggestions
 * @property {Object[]} hotelSuggestions
 * @property {Object[]} foodPlan
 * @property {string[]} packingList
 * @property {string[]} safetyTips
 * @property {Object[]} weatherNotes
 * @property {string[]} alternatives
 * @property {string[]} warnings
 * @property {Object} emergencyCard
 * @property {DayItinerary[]} dayWiseItinerary
 * @property {Object} tripScore
 * @property {Object[]} criticNotes
 * @property {Object[]} researchSources
 * @property {string[]} qualityNotes
 * @property {Object} generationContext
 */

/**
 * @typedef {Object} DayItinerary
 * @property {number} day
 * @property {string} date
 * @property {string} theme
 * @property {string} summary
 * @property {string} startArea
 * @property {string} endArea
 * @property {number} [walkingEstimateMinutes]
 * @property {string[]} advanceBookings
 * @property {ScheduleEntry[]} schedule
 * @property {Object[]} meals
 * @property {number} dailyBudget
 * @property {string} rainyDayAlternative
 * @property {string} localTip
 * @property {string} paceNotes
 * @property {boolean} [checkpointSaved]
 */

/**
 * @typedef {Object} ScheduleEntry
 * @property {string} time
 * @property {string} duration
 * @property {string} activity
 * @property {string} location
 * @property {string} [placeId]
 * @property {[number,number]} [coordinates]
 * @property {string} details
 * @property {string} [openingHours]
 * @property {number} [entryFee]
 * @property {number} [travelTimeMinutes]
 * @property {string} [transport]
 * @property {number} [routeDistanceKm]
 * @property {number} estimatedCost
 * @property {boolean} bookingRequired
 * @property {string} [bookingAdvice]
 * @property {string} [sourceUrl]
 */

export {};
