# EIP

The EIP (Elastic IP) resource lets you manage [AWS EC2 Elastic IPs](https://docs.aws.amazon.com/ec2/latest/userguide/) for your cloud infrastructure.

## Minimal Example

Create a basic Elastic IP with an optional tag.

```ts


const elasticIp = await AWS.EC2.EIP("myElasticIP", {
  Tags: [
    {
      Key: "Name",
      Value: "MyElasticIP"
    }
  ]
});
```

## Advanced Configuration

Allocate an Elastic IP from a specific IP address pool and attach it to an EC2 instance.

```ts


const instanceId = "i-0abcd1234efgh5678"; // Replace with your EC2 instance ID

const advancedElasticIp = await AWS.EC2.EIP("advancedElasticIP", {
  InstanceId: instanceId,
  PublicIpv4Pool: "my-public-ipv4-pool",
  Tags: [
    {
      Key: "Environment",
      Value: "Production"
    }
  ]
});
```

## Using IPAM Pool

Allocate an Elastic IP from an IPAM pool.

```ts


const ipamPoolId = "ipam-pool-12345678"; // Replace with your IPAM pool ID

const ipamElasticIp = await AWS.EC2.EIP("ipamElasticIP", {
  IpamPoolId: ipamPoolId,
  Tags: [
    {
      Key: "Service",
      Value: "WebServer"
    }
  ]
});
```

## Transfer Elastic IP Address

Transfer an Elastic IP address to another AWS account.

```ts


const transferElasticIp = await AWS.EC2.EIP("transferElasticIP", {
  TransferAddress: "203.0.113.25", // Replace with the Elastic IP address to transfer
  Tags: [
    {
      Key: "Transfer",
      Value: "Pending"
    }
  ]
});
```
