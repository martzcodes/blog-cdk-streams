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

    let data1 = await RDSDATA.executeStatement({
      secretArn: process.env.SECRETARN,
      resourceArn: process.env.DBCLUSTERARN,
      sql: `CREATE DATABASE chefdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    } as RDSDataService.ExecuteStatementRequest).promise();

    let data2 = await RDSDATA.executeStatement({
      secretArn: process.env.SECRETARN,
      resourceArn: process.env.DBCLUSTERARN,
      sql: `CREATE table chefdb.cheftable(id BIGINT AUTO_INCREMENT, cheffirst VARCHAR(255), cheflast VARCHAR(255), PRIMARY KEY (id))`,
    } as RDSDataService.ExecuteStatementRequest).promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<html><body>This is path ${event.path} here is your data ${JSON.stringify(data2, null, 2)}</body></html>\n`,
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
