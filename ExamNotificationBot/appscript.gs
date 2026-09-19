/**
 * ====================================================================
 * PAGE LEARNING - GOOGLE APPS SCRIPT EXAM MARKS TRIGGER
 * ====================================================================
 * 
 * Instructions:
 * 1. Open your Google Form or linked Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code and paste this script.
 * 4. Update the BOT_WEBHOOK_URL with your Vercel deployment URL:
 *    var BOT_WEBHOOK_URL = "https://<your-vercel-deployment>.vercel.app/api/notify";
 * 5. Click the Triggers icon (clock icon on the left) > Add Trigger:
 *    - Function: onFormSubmit
 *    - Event Source: From spreadsheet / From form
 *    - Event Type: On form submit
 * 6. Save and authorize the script permissions.
 */

var BOT_WEBHOOK_URL = "https://your-bot-deployment.vercel.app/api/notify";

function onFormSubmit(e) {
  try {
    var studentName = "Student";
    var marks = 0;
    var maxMarks = 100;
    var department = "General";
    var examTitle = "CUET Mock Exam";

    // Scenario A: Triggered from Google Form Quiz
    if (e && e.response) {
      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        var item = itemResponses[i].getItem();
        var title = item.getTitle().toLowerCase();
        var resp = itemResponses[i].getResponse();

        if (title.indexOf("name") !== -1 || title.indexOf("student") !== -1) {
          studentName = resp;
        }
      }
      
      // If quiz score is available on FormResponse
      if (typeof e.response.getScore === 'function') {
        var score = e.response.getScore();
        if (score !== null && score !== undefined) {
          marks = score;
        }
      }
    }

    // Scenario B: Triggered from Linked Google Sheet
    if (e && e.namedValues) {
      // Find Name column
      for (var key in e.namedValues) {
        var lowerKey = key.toLowerCase();
        if (lowerKey.indexOf("name") !== -1) {
          studentName = e.namedValues[key][0];
        }
        if (lowerKey.indexOf("score") !== -1) {
          // Format could be "85.00 / 100" or "85"
          var rawScore = e.namedValues[key][0];
          var parts = rawScore.split("/");
          marks = parseFloat(parts[0].trim());
          if (parts.length > 1) {
            maxMarks = parseFloat(parts[1].trim());
          }
        }
      }
    }

    // Calculate percentage
    var percentage = Math.round((marks / maxMarks) * 100);

    // Build payload
    var payload = {
      studentName: studentName,
      marks: marks,
      maxMarks: maxMarks,
      percentage: percentage,
      department: department,
      examTitle: examTitle
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(BOT_WEBHOOK_URL, options);

  } catch (err) {
    Logger.log("Error in onFormSubmit: " + err.toString());
  }
}
