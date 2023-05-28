// Require the Client constructor from the pg package
const { Client } = require("pg");
// Create a constant, CONNECTION_STRING, from either process.env.DATABASE_URL or postgres://localhost:5432/phenomena-dev

// const CONNECTION_STRING = process.env.DB_URL;

const client = new Client(
  "postgres://postgres:postgres@localhost:5432/phenomena-dev"
);
// Create the client using new Client(CONNECTION_STRING)

// const client = new Client({
//   user: "postgres",
//   password: "postgres",
//   database: "phenomena-dev",
// });

// Do not connect to the client in this file!

/**
 * Report Related Methods
 */

/**
 * You should select all reports which are open.
 *
 * Additionally you should fetch all comments for these
 * reports, and add them to the report objects with a new field, comments.
 *
 * Lastly, remove the password field from every report before returning them all.
 */
async function getOpenReports() {
  try {
    const { rows: reports } = await client.query(`
    SELECT id, title, location, description, "isOpen", "expirationDate"
    FROM reports
    WHERE "isOpen" = true
    `);

    for (let report of reports) {
      const { rows: comments } = await client.query(
        `
      SELECT * 
      FROM comments 
      WHERE "reportId" = $1
      `,
        [report.id]
      );

      report.comments = comments;
      report.isExpired = Date.parse(report.expirationDate) < new Date();
      delete report.password;
    }
    return reports;
    // first load all of the reports which are open
    // then load the comments only for those reports, using a
    // WHERE "reportId" IN () clause
    // then, build two new properties on each report:
    // .comments for the comments which go with it
    // it should be an array, even if there are none
    // .isExpired if the expiration date is before now
    // you can use Date.parse(report.expirationDate) < new Date()
    // also, remove the password from all reports
    // finally, return the reports
  } catch (error) {
    throw error;
  }
}

/**
 * You should use the reportFields parameter (which is
 * an object with properties: title, location, description, password)
 * to insert a new row into the reports table.
 *
 * On success, you should return the new report object,
 * and on failure you should throw the error up the stack.
 *
 * Make sure to remove the password from the report object
 * before returning it.
 */
async function createReport(reportFields) {
  // Get all of the fields from the passed in object
  const title = reportFields.title;
  const location = reportFields.location;
  const description = reportFields.description;
  const password = reportFields.password;

  try {
    // insert the correct fields into the reports table
    const SQL = `
    INSERT INTO reports (title, location, description, password) 
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `;

    const response = await client.query(SQL, [
      title,
      location,
      description,
      password,
    ]);

    const report = response.rows[0];
    delete report.password;
    return report;
    // remember to return the new row from the query
    // remove the password from the returned row
    // return the new report
  } catch (error) {
    throw error;
  }
}

/**
 * NOTE: This function is not for use in other files, so we use an _ to
 * remind us that it is only to be used internally.
 * (for our testing purposes, though, we WILL export it)
 *
 * It is used in both closeReport and createReportComment, below.
 *
 * This function should take a reportId, select the report whose
 * id matches that report id, and return it.
 *
 * This should return the password since it will not eventually
 * be returned by the API, but instead used to make choices in other
 * functions.
 */
async function _getReport(reportId) {
  try {
    const {
      rows: [report],
    } = await client.query(
      `SELECT *
       FROM reports
       WHERE id = $1
       `,
      [reportId]
    );
    return report;
    // SELECT the report with id equal to reportId
    // return the report
  } catch (error) {
    throw error;
  }
}

/**
 * You should update the report where the reportId
 * and password match, setting isOpen to false.
 *
 * If the report is updated this way, return an object
 * with a message of "Success".
 *
 * If nothing is updated this way, throw an error
 */

async function closeReport(reportId, password) {
  try {
    const {
      rows: [report],
    } = await client.query(
      `
          SELECT * 
          FROM reports
          WHERE id = $1
        `,
      [reportId]
    );

    // Check if report exists
    if (!report) {
      throw new Error("Report does not exist with that id");
    }

    // Check if passwords match
    if (report.password !== password) {
      throw new Error("Password incorrect for this report, please try again");
    }

    // Check if report is already closed
    if (report.isOpen === false) {
      throw new Error("This report has already been closed");
    }

    // Close the report
    const {
      rows: [updatedReport],
    } = await client.query(
      `
          UPDATE reports
          SET "isOpen" = false
          WHERE id = $1
          RETURNING *;
        `,
      [reportId]
    );

    // If report is successfully updated, return a success message
    if (updatedReport) {
      return { message: "Report successfully closed!" };
    }

    throw new Error("Failed to close the report");
  } catch (error) {
    throw error;
  }
}

// First, actually grab the report with that id
// If it doesn't exist, throw an error with a useful message
// If the passwords don't match, throw an error
// If it has already been closed, throw an error with a useful message
// Finally, update the report if there are no failures, as above
// Return a message stating that the report has been closed

/**
 * Comment Related Methods
 */

/**
 * If the report is not found, or is closed or expired, throw an error
 *
 * Otherwise, create a new comment with the correct
 * reportId, and update the expirationDate of the original
 * report to CURRENT_TIMESTAMP + interval '1 day'
 */
async function createReportComment(reportId, commentFields) {
  // read off the content from the commentFields
  const { content } = commentFields;

  try {
    // grab the report we are going to be commenting on
    const {
      rows: [report],
    } = await client.query(
      `
        SELECT id, "isOpen", "expirationDate"
        FROM reports
        WHERE id=$1;
        `,
      [reportId]
    );

    // if it wasn't found, throw an error saying so
    if (!report) {
      throw new Error("That report does not exist, no comment has been made");
    }
    // if it is not open, throw an error saying so
    if (!report.isOpen) {
      throw new Error("That report has been closed, no comment has been made");
    }
    // if the current date is past the expiration, throw an error saying so

    // you can use Date.parse(report.expirationDate) < new Date() to check
    if (Date.parse(report.expirationDate) < new Date()) {
      throw new Error(
        "The discussion time on this report has expired, no comment has been made"
      );
    }

    // all go: insert a comment
    const {
      rows: [comment],
    } = await client.query(
      `
      INSERT INTO comments ("reportId", content)
      VALUES ($1, $2)
      RETURNING *;
      `,
      [reportId, content]
    );

    // then update the expiration date to a day from now
    await client.query(
      `
      UPDATE reports
      SET "expirationDate"= CURRENT_TIMESTAMP + interval '1 day'
      WHERE id=$1
      `,
      [reportId]
    );

    // finally, return the comment
    return comment;
  } catch (error) {
    throw error;
  }
}

// export the client and all database functions below
module.exports = {
  client,
  createReport,
  getOpenReports,
  _getReport,
  closeReport,
  createReportComment,
};
