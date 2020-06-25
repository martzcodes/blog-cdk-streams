import { DynamoDB } from "aws-sdk";

const db = new DynamoDB.DocumentClient();

export const handler = async (event: any): Promise<any> => {
console.log(event);
  if (!event.body) {
    return {
      statusCode: 400,
      body: "invalid request, you are missing the parameter body",
    };
  }

  const body = JSON.parse(event.body);

  try {
    const review = await db
      .update({
        TableName: "chef",
        Key: {
          ChefId: `${body.lastName || "Ramsay"}#${body.firstName || "Gordon"}`,
        },
        UpdateExpression: "set firstName = :first, lastName = :last",
        ExpressionAttributeValues: {
          ":first": `${body.firstName || "Gordon"}`,
          ":last": `${body.lastName || "Ramsay"}`,
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();
    console.log(`Update complete. ${JSON.stringify(review)}`);
    return {
      statusCode: 200,
      headers: {},
      body: JSON.stringify(review),
    };
  } catch (e) {
    console.error("GET failed! ", e);
    return {
      statusCode: 400,
      headers: {},
      body: `Update failed: ${e}`,
    };
  }
};
