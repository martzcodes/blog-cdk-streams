import { Construct, Stack, StackProps, Duration, RemovalPolicy } from "@aws-cdk/core";
import { Vpc } from "@aws-cdk/aws-ec2";
import { Runtime, StartingPosition } from "@aws-cdk/aws-lambda";
import { AuroraServerless } from "./auroraserverless";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { LambdaRestApi, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { Table, BillingMode, AttributeType, StreamViewType } from '@aws-cdk/aws-dynamodb';
import {
  DynamoEventSource,
  DynamoEventSourceProps,
} from "@aws-cdk/aws-lambda-event-sources";

const lambdaPath = `${__dirname}/lambda`;
export class BlogCdkStreamsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const serviceName = "chef";

    const vpc = new Vpc(this, `${serviceName}-vpc`, {
      maxAzs: 2,
    });

    var aurora = new AuroraServerless(
      this,
      `aurora-serverless-${serviceName}`,
      {
        vpc: vpc,
        clusterName: serviceName,
      }
    );

    // define the mysql lambdas
    const auroraEnv = {
        DBCLUSTERARN: aurora.clusterarn,
        DBCLUSTERID: aurora.clusterid,
        SECRETARN: aurora.secretarn,
      };
    const getAuroraChefs = new NodejsFunction(this, "getAuroraChefsFunction", {
      entry: `${lambdaPath}/get-aurora-chefs.ts`,
      handler: "handler",
      runtime: Runtime.NODEJS_12_X,
      environment: auroraEnv,
      timeout: Duration.seconds(60),
    });

    const initAurora = new NodejsFunction(this, "initAuroraFunction", {
      entry: `${lambdaPath}/init-aurora.ts`,
      handler: "handler",
      runtime: Runtime.NODEJS_12_X,
      environment: auroraEnv,
      timeout: Duration.seconds(60),
    });

    const writeAuroraChefs = new NodejsFunction(
      this,
      "writeAuroraChefsFunction",
      {
        entry: `${lambdaPath}/write-aurora-chefs.ts`,
        handler: "handler",
        runtime: Runtime.NODEJS_12_X,
        environment: auroraEnv,
        timeout: Duration.seconds(60),
      }
    );

    const secretStatement = new PolicyStatement();
    secretStatement.addResources(aurora.secretarn);
    secretStatement.addActions(
      "secretsmanager:GetSecretValue",
      "secretsmanager:PutResourcePolicy",
      "secretsmanager:PutSecretValue",
      "secretsmanager:DeleteSecret",
      "secretsmanager:DescribeSecret",
      "secretsmanager:TagResource"
    );
    getAuroraChefs.addToRolePolicy(secretStatement);
    writeAuroraChefs.addToRolePolicy(secretStatement);
    initAurora.addToRolePolicy(secretStatement);

    const rdsStatement = new PolicyStatement();
    rdsStatement.addResources(aurora.clusterarn);
    rdsStatement.addActions(
      "secretsmanager:CreateSecret",
      "secretsmanager:ListSecrets",
      "secretsmanager:GetRandomPassword",
      "tag:GetResources",
      "rds-data:BatchExecuteStatement",
      "rds-data:BeginTransaction",
      "rds-data:CommitTransaction",
      "rds-data:ExecuteStatement",
      "rds-data:RollbackTransaction"
    );
    getAuroraChefs.addToRolePolicy(rdsStatement);
    writeAuroraChefs.addToRolePolicy(rdsStatement);
    initAurora.addToRolePolicy(rdsStatement);

    const api = new LambdaRestApi(this, "chef-api", {
      handler: getAuroraChefs,
      proxy: false,
    });

    const auroraResource = api.root.addResource("aurora");
    auroraResource.addMethod("GET", new LambdaIntegration(initAurora));
    const auroraChefsResource = auroraResource.addResource("chefs");
    auroraChefsResource.addMethod("GET", new LambdaIntegration(getAuroraChefs));
    auroraChefsResource.addMethod("POST", new LambdaIntegration(writeAuroraChefs));


    // start dynamo...

    const dynamoTable = new Table(this, serviceName, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: `ChefId`,
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: serviceName,
      stream: StreamViewType.NEW_IMAGE,
    });
    // EASY!

    const updateDynamoChef = new NodejsFunction(this, "updateDynamoChef", {
      entry: `${lambdaPath}/put-dynamo-chef.ts`,
      handler: "handler",
      runtime: Runtime.NODEJS_12_X,
    });

    const getDynamoChefs = new NodejsFunction(this, "getDynamoChefsFunction", {
      entry: `${lambdaPath}/get-dynamo-chefs.ts`,
      handler: "handler",
      runtime: Runtime.NODEJS_12_X,
    });

    dynamoTable.grantReadWriteData(updateDynamoChef);
    dynamoTable.grantReadData(getDynamoChefs);

    const dynamoResource = api.root.addResource("dynamo");
    const dynamoChefsResource = dynamoResource.addResource("chefs");
    dynamoChefsResource.addMethod("GET", new LambdaIntegration(getDynamoChefs));
    dynamoChefsResource.addMethod(
      "POST",
      new LambdaIntegration(updateDynamoChef)
    );

    const eventSourceProps: DynamoEventSourceProps = {
      startingPosition: StartingPosition.LATEST,
      batchSize: 1,
    };

    writeAuroraChefs.addEventSource(new DynamoEventSource(dynamoTable as any, eventSourceProps) as any);
  }
}
