import { APIGatewayProxyHandlerV2 } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => { // Note change
  try {
    console.log("Event: ", event);
    const parameters = event?.queryStringParameters;
    const cast = parameters?.cast == "true";
    const movieId = event?.pathParameters?.movieId ? parseInt(event.pathParameters.movieId) : undefined;
    
    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie Id" }),
      };
    }

    const commandMovie = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { movieId: movieId },
      })
    );
    console.log("GetCommand response: ", commandMovie);
    if (!commandMovie.Item){
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({Message: "Invalid movie Id"}),
      };
    }

    const body = {
      data: commandMovie.Item,
    };

    if(cast) {
      const commandCast = await ddbDocClient.send(
        new QueryCommand({
          TableName: process.env.CAST_TABLE_NAME, KeyConditionExpression: "movieId = :m", ExpressionAttributeValues:
            { ":m": movieId },
        })
      );

      //If the cast is retrived,
      if(commandCast.Items) {
        //The commandMovie is of the type "Record", which is simply a key and value pair from what I understand.
        //Cast is key, and commandCast.Items is value
        //https://stackoverflow.com/questions/66000470/add-element-to-typescript-record
        commandMovie.Item["cast"] = commandCast.Items
      }else{
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Error getting cast" }),
        };
      }
    }

    // Return Response
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
