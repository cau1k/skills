# TypeActivation

The TypeActivation resource allows you to register a CloudFormation type for use in your stacks. This includes custom resource types that are defined by your organization or other AWS resources. For more information, refer to the [AWS CloudFormation TypeActivations](https://docs.aws.amazon.com/cloudformation/latest/userguide/).

## Minimal Example

Create a basic TypeActivation with the required properties and one optional property.

```ts


const typeActivation = await AWS.CloudFormation.TypeActivation("MyTypeActivation", {
  TypeName: "MyCustom::Resource",
  ExecutionRoleArn: "arn:aws:iam::123456789012:role/MyExecutionRole",
  MajorVersion: "1.0"
});
```

## Advanced Configuration

Configure a TypeActivation with additional features like logging and auto-update.

```ts


const advancedTypeActivation = await AWS.CloudFormation.TypeActivation("AdvancedTypeActivation", {
  TypeName: "MyAdvanced::Resource",
  ExecutionRoleArn: "arn:aws:iam::123456789012:role/MyExecutionRole",
  MajorVersion: "1.0",
  AutoUpdate: true,
  LoggingConfig: {
    LogGroupArn: "arn:aws:logs:us-east-1:123456789012:log-group:MyLogGroup",
    LogRoleArn: "arn:aws:iam::123456789012:role/MyLoggingRole"
  }
});
```

## Adoption of Existing Resources

Adopt an existing resource if the TypeActivation already exists.

```ts


const adoptExistingTypeActivation = await AWS.CloudFormation.TypeActivation("AdoptExistingTypeActivation", {
  TypeName: "MyCustom::Resource",
  ExecutionRoleArn: "arn:aws:iam::123456789012:role/MyExecutionRole",
  MajorVersion: "1.0",
  adopt: true
});
```

## Custom Type with Alias

Register a TypeActivation with a custom alias for easier reference in your stacks.

```ts


const aliasTypeActivation = await AWS.CloudFormation.TypeActivation("AliasTypeActivation", {
  TypeName: "MyCustom::Resource",
  ExecutionRoleArn: "arn:aws:iam::123456789012:role/MyExecutionRole",
  MajorVersion: "1.0",
  TypeNameAlias: "MyResourceAlias"
});
```
