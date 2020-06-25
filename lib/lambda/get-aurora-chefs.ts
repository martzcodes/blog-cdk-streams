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

export const handler = async (event: any): Promise<any> => {
  try {
    console.log("START");
    console.log(event);
    console.log("ENV SECRETARN: " + process.env.SECRETARN);
    console.log("ENV DBCLUSTERARN: " + process.env.DBCLUSTERARN);
    console.log("ENV DBCLUSTERID: " + process.env.DBCLUSTERID);

    var data1 = await RDSDATA.executeStatement({
      secretArn: process.env.SECRETARN,
      resourceArn: process.env.DBCLUSTERARN,
      includeResultMetadata: true,
      sql: `select * from cheftable`,
      database: "chefdb",
    } as RDSDataService.ExecuteStatementRequest).promise();
    var tabledata = JSON.stringify(data1, null, 2);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body>This is path ${event.path} here is your data ${tabledata}</body></html>\n`,
    };

    //END IF action
  } catch (e) {
    console.log(e);
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body>Exception ${e} You've hit ${event.path} </body></html>\n`,
    };
  }
};
