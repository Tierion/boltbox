# Bootstrap Simnet Testing Environment

```
+ ----- +                   + --- +
| Alice | <--- channel ---> | Bob |  <---   Bob and Alice are the lightning network daemons which 
+ ----- +                   + --- +         create channels and interact with each other using the   
    |                          |            Bitcoin network as source of truth. 
    |                          |            
    + - - - -  - + - - - - - - +            
                 |
        + --------------- +
        | Bitcoin network |  <---  In the current scenario for simplicity we create only one  
        + --------------- +        "btcd" node which represents the Bitcoin network, in a 
                                    real situation Alice and Bob will likely be 
                                    connected to different Bitcoin nodes.
```



## Troubleshooting
The best thing to try and do to troubleshoot any issues is make sure all associated containers 
have been torn down as well as all shared volumes. The way that the node containers know about each other 
is through a shared volume `/lnd-data`. This gets persisted though even if an associated container
has been fully removed. 

An example of where this can cause problems is if you have a tls certificate that needs to be regenerated.
In order for the cert to be regenerated though, the old one needs to be deleted. The output from the script
can give you a hints regarding this. For example, since the node containers take the set namespaces `alice`,
`bob`, and `carol`, it will tell you if those containers already exist and skip the command to create them.

## TODO:

- [ ] Consider creating lnd.conf files for each lnd container rather than setting in command line
