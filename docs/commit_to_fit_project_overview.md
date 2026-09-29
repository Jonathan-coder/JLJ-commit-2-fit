Project Name: Commit to Fit
Team: Team JLJ (Josuah De Martino, Leopold Saiko, Jonathan Hafner)
Supervisor / Lecturer: Mag.a Rea Sutter, BSc
Institution:Technikum Wien


Vision:
More than just a calorie tracker.

Description:
A calorie tracker without ads, that can scan nutritional facts from products, save them in a shared database and use them to calculate your nutritional intake. Calories aren't enough, we're also interested in the macro nutrients. Everything is doable with a mobile phone which connects to the external db via REST requests.

Functional Requirements:
- select product from saved products
- scan nutritional facts with phone
- save facts in central db if product not already there
- calculate and save personal intake
- display history of intake on phone app
- show warning when intake (calories, macros) is too low or too large (relative to height, weight, activity level)
- timer for intermittent or religious fasting

Non-Functional Requirements:
- usability
- responsive
- simultaneous accesses possible
- fast load time