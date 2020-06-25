import cdk = require("@aws-cdk/core");
import {
  CfnDBCluster,
  DatabaseSecret,
  CfnDBSubnetGroup,
} from "@aws-cdk/aws-rds";
import secretsmanager = require("@aws-cdk/aws-secretsmanager");
import {
  ISecretAttachmentTarget,
} from "@aws-cdk/aws-secretsmanager";
import ec2 = require("@aws-cdk/aws-ec2");
import {
  ISecurityGroup,
  IVpc,
  SecurityGroup,
  SubnetSelection,
} from "@aws-cdk/aws-ec2";

export interface AuroraServerlessProps {
  readonly vpc: IVpc;
  readonly clusterName: string;
}

export class AuroraServerless extends cdk.Construct
  implements ISecretAttachmentTarget {
  public vpc: IVpc;
  public vpcSubnets: SubnetSelection;
  public securityGroup: ISecurityGroup;
  public securityGroupId: string;

  public secretarn: string;
  public clusterarn: string;
  public clusterid: string;

  constructor(
    scope: cdk.Construct,
    id: string,
    private props: AuroraServerlessProps
  ) {
    super(scope, id);

    this.vpc = props.vpc;
    //this.vpcSubnets = props.subnets;

    const secret = new DatabaseSecret(this, "MasterUserSecretDemoDataApi", {
      username: "dbroot",
    });
    this.secretarn = secret.secretArn;

    new cdk.CfnOutput(this, "SecretARN", {
      value: secret.secretArn,
    });

    const securityGroup = new SecurityGroup(this, "DatabaseSecurityGroup", {
      allowAllOutbound: true,
      description: `DB Cluster (${props.clusterName}) security group`,
      vpc: props.vpc,
    });
    this.securityGroup = securityGroup;
    this.securityGroupId = securityGroup.securityGroupId;

    const dbcluster = new CfnDBCluster(this, "apidbcluster", {
      engine: "aurora",
      engineMode: "serverless",
      masterUsername: secret.secretValueFromJson("username").toString(),
      masterUserPassword: secret.secretValueFromJson("password").toString(),
      deletionProtection: false,
      enableHttpEndpoint: true, // this is important!
      scalingConfiguration: {
        autoPause: true,
        minCapacity: 1,
        maxCapacity: 16,
        secondsUntilAutoPause: 300,
      },
      dbSubnetGroupName: new CfnDBSubnetGroup(this, "db-subnet-group", {
        dbSubnetGroupDescription: `${props.clusterName} database cluster subnet group`,
        subnetIds: props.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE,
        }).subnetIds,
      }).ref,
    });

    var region = cdk.Stack.of(this).region;
    var account = cdk.Stack.of(this).account;
    this.clusterarn = `arn:aws:rds:${region}:${account}:cluster:${dbcluster.ref}`;
    this.clusterid = `${dbcluster.ref}`;

    new cdk.CfnOutput(this, "DBClusterARN", {
      value: this.clusterarn,
    });
    new cdk.CfnOutput(this, "DBClusterDBIdentifier", {
      value: this.clusterid,
    });
    secret.addTargetAttachment("AttachedSecret", {
      target: this,
    });
  }

  public asSecretAttachmentTarget(): secretsmanager.SecretAttachmentTargetProps {
    return {
      targetId: this.clusterarn,
      targetType: secretsmanager.AttachmentTargetType.CLUSTER,
    };
  }
}
