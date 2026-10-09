## Open Questions 

# Class Questions Class 2

1. Does "scan nutritional facts" mean OCR of the nutrition label,
   barcode scanning, or both?

2. Which nutritional values need to be tracked?
   - Calories
   - Protein
   - Carbohydrates
   - Fat
   - Other?

3. How should the calorie requirement be calculated?

4. What exactly counts as "too high" or "too low"?

5. Do users need an account/login?

6. Should products be visible to all users?

7. Which mobile platform should we target?

8. Are external nutrition databases/APIs allowed?

9. How detailed does the fasting timer need to be?

# Anwsers Class 2
1. Scanning Nutritional Facts
Functionality: Users can input their own data (calories, macros, etc.) manually. Additionally, external food databases/APIs are allowed and utilized for fetching nutritional information.

References & Data Sources:

Food CSV Data: Open Food Facts Data Source

Food API Request / Barcode Scanning: [TeamzLab Health Food Barcode Scanner API Reference](https://tool.teamzlab.com/health/food-barcode-scanner/#:~:text=Products%20are%20scored%20from%20A%20(best%20nutritional,vegetables%20with%20low%20sugar%2C%20fat%2C%20and%20salt.)

2. User Accounts & Architecture
Platform & Type: The application is web-based (accessible via browser/mobile platforms like Android).

Accounts & Login: User accounts depend on the system architecture.

Multi-Device Support: The system supports simultaneous access, allowing multiple devices to log into and sync with a single user account.

3. User Diary & Documentation
User Diary: A user diary feature is required to track daily intake and logs, which should ideally be represented and visualized within the application interface.

Documentation Requirements: User roles must be explicitly defined and included in the project documentation.