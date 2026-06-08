# Personalization Data Migration & Flattening Guide

To drastically improve the performance of our recommendation engine and enable future features like Targeted Notifications, we migrated from deep-nested real-time iteration to **Data Flattening**.

## What Was Changed?

1. **Job Schema (`Job.js`)**: 
   - Added three root-level arrays: `streams`, `specializations`, and `searchTokens`.
   - Added a `pre('save')` Mongoose hook. Any time a job is created or updated, Mongoose auto-compiles all tags, domains, and education branches into these flat arrays.
2. **Recommendation Engine (`recommendationService.js`)**: 
   - Replaced O(N²) complex `.flatMap()` and `.some()` loops with O(1) direct `.includes()` checks against the flat arrays.
3. **Startup Auto-Migration (`utils/startupMigration.js`)**:
   - Because production databases might contain legacy records or manually inserted jobs (which bypass Mongoose hooks), a background worker automatically runs on `index.js` startup.
   - It forcefully patches schema validation errors (e.g. converting legacy `GRADUATION` strings to standard `EDU_GRAD` enums, and fixing corrupted `correctionWindow` strings).
   - It then iterates over the `jobs` and `oldjobs` collections and populates the flat arrays if they are missing.

## Important Maintenance Notes

- **Valid Enums Are Critical**: The new validation schemas strictly enforce the standard education codes (`EDU_10TH`, `EDU_12TH`, `EDU_GRAD`, etc.). If you manually insert jobs into the database using old codes like `INTERMEDIATE`, the `startupMigration.js` script will attempt to patch it, but you should avoid inserting dirty data to prevent application errors.
- **Background Execution**: The startup script accesses the database via raw MongoDB driver collections (`mongoose.connection.db.collection`) to avoid triggering Mongoose validation crashes on legacy records.
- **Reference**: Review the updated `Jobschema.md` for a full JSON example of how the new `searchTokens`, `streams`, and `specializations` fields look in practice.
