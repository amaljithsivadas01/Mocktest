/**
 * ====================================================================
 * PAGE LEARNING - GOOGLE APPS SCRIPT EXAM MARKS TRIGGER & PROXY
 * ====================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Form or linked Google Spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Replace all existing text with this script.
 * 4. Verify BOT_WEBHOOK_URL points to your Vercel bot deployment:
 *    var BOT_WEBHOOK_URL = "https://exam-notification-bot.vercel.app/api/notify";
 * 5. (Option A - Automatic Trigger on Submit):
 *    - Click the clock icon on the left menu (Triggers) > '+ Add Trigger'.
 *    - Choose function: 'onFormSubmit'
 *    - Event source: 'From spreadsheet' (or 'From form')
 *    - Event type: 'On form submit'
 *    - Save and grant permissions.
 * 
 * 6. (Option B - Web App Proxy):
 *    - Click Deploy > New deployment > Web app.
 *    - Execute as: 'Me'
 *    - Who has access: 'Anyone'
 * ====================================================================
 */

var BOT_WEBHOOK_URL = "https://exam-notification-bot.vercel.app/api/notify";

// Entry IDs configuration for all 3 departments (hidden securely on Google Apps Script)
var FORMS_CONFIG = {
  science: {
    title: "CUET UG CHEMISTRY 1",
    department: "Department of Science",
    actionUrl: "https://docs.google.com/forms/d/e/1FAIpQLScx0EcpmwWnuPwVWEa5g22_vlekBUu8q3_WZRFRGFOni_da-Q/formResponse",
    nameEntry: "entry.271341288"
  },
  humanities: {
    title: "CUET UG HISTORY 1",
    department: "Department of Humanities",
    actionUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfSsPceCoZt-K91EmTwDaPmZwQYVSmUAIg0zH6HAOzy4IAUhg/formResponse",
    nameEntry: "entry.836112701"
  },
  commerce: {
    title: "CUET UG BUSINESS STUDIES 1",
    department: "Department of Commerce",
    actionUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeOEdoTYgQe0qZd8C6Ojs8ViRct-klN3ft5jpuHlVO-te0cAw/formResponse",
    nameEntry: "entry.582359518",
    batchEntry: "entry.167188585"
  }
};

/**
 * Triggered automatically whenever a form response is submitted
 */
function onFormSubmit(e) {
  try {
    var studentName = "Student";
    var marks = 0;
    var maxMarks = 100;
    var department = "General";
    var examTitle = "CUET Mock Test";

    // 1. Extract from Google Form Quiz event
    if (e && e.response) {
      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        var item = itemResponses[i].getItem();
        var title = (item.getTitle() || "").toLowerCase();
        var resp = itemResponses[i].getResponse();

        if (title.indexOf("name") !== -1 || title.indexOf("student") !== -1) {
          studentName = resp;
        }
      }

      // Quiz Score
      if (typeof e.response.getScore === 'function') {
        var score = e.response.getScore();
        if (score !== null && score !== undefined) {
          marks = score;
        }
      }
      
      // Determine form title
      var form = FormApp.getActiveForm();
      if (form) {
        examTitle = form.getTitle();
      }
    }

    // 2. Extract from Linked Google Sheet event
    if (e && e.namedValues) {
      for (var key in e.namedValues) {
        var lowerKey = key.toLowerCase();
        if (lowerKey.indexOf("name") !== -1) {
          studentName = e.namedValues[key][0];
        }
        if (lowerKey.indexOf("score") !== -1) {
          var rawScore = e.namedValues[key][0];
          var parts = rawScore.split("/");
          marks = parseFloat(parts[0].trim());
          if (parts.length > 1) {
            maxMarks = parseFloat(parts[1].trim());
          }
        }
      }
      var sheet = SpreadsheetApp.getActiveSpreadsheet();
      if (sheet) {
        examTitle = sheet.getName();
      }
    }

    var percentage = Math.round((marks / maxMarks) * 100);

    // Forward to Telegram Notification Bot Webhook
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

/**
 * Web App endpoint (doPost) for proxying submissions directly from website
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var dept = data.dept || "science";
    var cfg = FORMS_CONFIG[dept];

    if (!cfg) {
      return jsonResponse({ ok: false, error: "Unknown department: " + dept });
    }

    // Submit to Google Forms formResponse
    var formPayload = [];
    if (cfg.nameEntry && data.studentName) {
      formPayload.push(encodeURIComponent(cfg.nameEntry) + "=" + encodeURIComponent(data.studentName));
    }
    if (cfg.batchEntry && (data.batch || dept === "commerce")) {
      formPayload.push(encodeURIComponent(cfg.batchEntry) + "=" + encodeURIComponent(data.batch || "COMMERCE"));
    }

    if (data.answers) {
      for (var entryId in data.answers) {
        formPayload.push(encodeURIComponent("entry." + entryId) + "=" + encodeURIComponent(data.answers[entryId]));
      }
    }

    UrlFetchApp.fetch(cfg.actionUrl, {
      method: "post",
      payload: formPayload.join("&"),
      contentType: "application/x-www-form-urlencoded",
      muteHttpExceptions: true
    });

    // Notify Telegram Bot
    if (data.marks !== undefined) {
      UrlFetchApp.fetch(BOT_WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          studentName: data.studentName,
          marks: data.marks,
          maxMarks: data.maxMarks || 100,
          percentage: data.percentage || 0,
          department: cfg.department,
          examTitle: cfg.title,
          durationSeconds: data.durationSeconds || 0
        }),
        muteHttpExceptions: true
      });
    }

    return jsonResponse({ ok: true, status: "success" });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
