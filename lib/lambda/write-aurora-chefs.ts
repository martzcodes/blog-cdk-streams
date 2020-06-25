import * as AWS from "aws-sdk";
import { RDSDataService } from "aws-sdk";

const RDSDATA = new AWS.RDSDataService();

AWS.config.update({
  maxRetries: 10,
  httpOptions: {
    timeout: 60000,
    connectTimeout: 60000,
  },
});

interface Chef {
  firstName: string;
  lastName: string;
}

const processEvent = (event: any): Chef[] => {
  if (event.body) {
    const body = JSON.parse(event.body);
    return [
      {
        firstName: body.firstName || "Gordon",
        lastName: body.lastName || "Ramsay",
      },
    ];
  }
  if (event.Records) {
    const inserts = event.Records.filter(
      (evt: any) =>  evt.eventName === "INSERT"
    );
    const items = inserts.map((ins: any) => {
      return {
        firstName: ins.dynamodb.NewImage.firstName.S || "Gordon",
        lastName: ins.dynamodb.NewImage.lastName.S || "Ramsay",
      };
    });
    return items;
  }
  return [];
};

export const handler = async (event: any): Promise<any> => {
  try {
    console.log("START");
    console.log(event);
    console.log("ENV SECRETARN: " + process.env.SECRETARN);
    console.log("ENV DBCLUSTERARN: " + process.env.DBCLUSTERARN);
    console.log("ENV DBCLUSTERID: " + process.env.DBCLUSTERID);

    const chefs = processEvent(event);

    const params3 = {
      secretArn: process.env.SECRETARN,
      resourceArn: process.env.DBCLUSTERARN,
      database: "chefdb",
      sql: `INSERT INTO cheftable(cheffirst,cheflast) VALUES (:cheffirst,:cheflast)`,
      parameterSets: chefs.map((chef: Chef) => {
        return [
          {
            name: "cheffirst",
            value: {
              stringValue: chef.firstName,
            },
          },
          {
            name: "cheflast",
            value: {
              stringValue: chef.lastName,
            },
          },
        ];
      }),
    };
    let data4 = await RDSDATA.batchExecuteStatement(
      params3 as RDSDataService.ExecuteStatementRequest
    ).promise();

    var tabledata = JSON.stringify(data4, null, 2);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body>This is path ${event.path} here is your response ${tabledata}</body></html>\n`,
    };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body>Exception ${e} You've hit ${event.path} </body></html>\n`,
    };
  }
};
