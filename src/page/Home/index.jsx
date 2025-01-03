import React, { useState, useEffect, useCallback } from 'react';
import { WalletTgSdk } from '@uxuycom/web3-tg-sdk';
import { ethers } from 'ethers';
import { Toast } from 'antd-mobile';
import Btn from '../../components/Btn';
import { CHAINS } from '../../config';

const DEFAULT_CHAIN_ID = '0x61';
const walletTgSdk = new WalletTgSdk();
const { ethereum } = walletTgSdk;

const contractAddress = "0xf6e7BF2f2bac37166e8b3AcaA1faD43a93D9718b";
const contractABI = [
  {
    inputs: [
      { internalType: "uint256", name: "groupId", type: "uint256" },
      { internalType: "address", name: "payer", type: "address" },
      { internalType: "address[]", name: "payees", type: "address[]" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "string", name: "description", type: "string" },
    ],
    name: "addExpense",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "address[]", name: "members", type: "address[]" },
    ],
    name: "createGroup",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "groupId", type: "uint256" },
      { internalType: "address", name: "payee", type: "address" },
    ],
    name: "settleDebt",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "groupId", type: "uint256" }],
    name: "getGroupMembers",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "groupId", type: "uint256" }],
    name: "getGroupBalances",
    outputs: [{ internalType: "int256[]", name: "balances", type: "int256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "groupCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];


const ExpenseManager = () => {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("0x61");
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState({
    connect: false,
    chain: false,
    contract: false
  });

  // Contract states
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [groupBalances, setGroupBalances] = useState([]);
  const [groupMembersList, setGroupMembersList] = useState([]);
  const [payer, setPayer] = useState("");
  const [payees, setPayees] = useState([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payeeAddress, setPayeeAddress] = useState("");
  const [settleAmount, setSettleAmount] = useState("");

  const showNotification = useCallback((message, isSuccess = true) => {
    Toast.show({
      content: <div className="text-body1 font-semibold text-center text-blue-500">{message}</div>,
      position: 'top',
      duration: 4000
    });
  }, []);

  const initEventListener = useCallback(() => {
    ethereum.removeAllListeners();
    ethereum.on('accountsChanged', (accounts) => setAddress(accounts[0]));
    ethereum.on('chainChanged', (_chainId) => {
      setChainId("0x" + Number(_chainId).toString(16));
    });
  }, []);

  const initContract = useCallback(async () => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      setContract(contract);
    } catch (error) {
      console.error("Contract initialization failed:", error);
    }
  }, [address]);

  useEffect(() => {
    const init = async () => {
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        const chainId = await ethereum.request({ method: 'eth_chainId' });
        setAddress(accounts[0]);
        setChainId(chainId);
        initEventListener();
        if (accounts[0]) {
          switchChain(DEFAULT_CHAIN_ID);
          initContract();
        }
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };
    init();
  }, [initEventListener, initContract]);

  const connectWallet = async () => {
    setLoading(prev => ({ ...prev, connect: true }));
    try {
      await ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      setAddress(accounts[0]);
      setChainId(chainId);
      showNotification('Wallet connected successfully');
      switchChain(DEFAULT_CHAIN_ID);
      initContract();
    } catch (error) {
      console.error('Connection failed:', error);
      showNotification('Failed to connect wallet', false);
    }
    setLoading(prev => ({ ...prev, connect: false }));
  };

  const switchChain = async (chainId) => {
    setLoading(prev => ({ ...prev, chain: true }));
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      showNotification("Chain switched successfully");
      initContract();
    } catch (error) {
      console.error("Chain switch failed:", error);
      showNotification("Failed to switch chain", false);
    }
    setLoading(prev => ({ ...prev, chain: false }));
  };

  // Contract functions remain the same as previous implementation
  const createGroup = async () => {
    if (!address) return showNotification("Please connect wallet", false);
    setLoading(prev => ({ ...prev, contract: true }));
    try {
      // Create group transaction
      const iface = new ethers.Interface(contractABI);
      const data = iface.encodeFunctionData('createGroup', [groupName, groupMembers]);
      
      const transaction = {
        from: address,
        to: contractAddress,
        data: data
      };
  
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [transaction],
      });
  
      // Get group count to determine new group ID
      const groupCountData = iface.encodeFunctionData('groupCount', []);
      const groupCountResult = await ethereum.request({
        method: 'eth_call',
        params: [
          {
            from: address,
            to: contractAddress,
            data: groupCountData
          },
          'latest'
        ]
      });
      
      const decodedGroupCount = iface.decodeFunctionResult('groupCount', groupCountResult);
      const newGroupId = decodedGroupCount[0].toString() - 1;
      
      setGroupId(newGroupId.toString());
      showNotification(`Group created with ID: ${newGroupId}`);
    } catch (error) {
      console.error(error);
      showNotification("Group creation failed", false);
    }
    setLoading(prev => ({ ...prev, contract: false }));
  };
  const addExpense = async () => {
    if (!address) return showNotification("Please connect wallet", false);
    setLoading(prev => ({ ...prev, contract: true }));
    try {
      const iface = new ethers.Interface(contractABI);
      const data = iface.encodeFunctionData('addExpense', [
        groupId,
        payer,
        payees,
        ethers.parseEther(amount),
        description
      ]);
      
      const transaction = {
        from: address,
        to: contractAddress,
        data: data
      };
  
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [transaction],
      });
      showNotification("Expense added successfully");
    } catch (error) {
      console.error(error);
      showNotification("Failed to add expense", false);
    }
    setLoading(prev => ({ ...prev, contract: false }));
  };
  
  const settleDebt = async () => {
    if (!address) return showNotification("Please connect wallet", false);
    setLoading(prev => ({ ...prev, contract: true }));
    try {
      const transaction = {
        from: address,
        to: payeeAddress,
        value: ethers.parseEther(settleAmount).toString()
      };
  
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [transaction],
      });
      showNotification("Payment sent successfully");
    } catch (error) {
      console.error(error);
      showNotification("Payment failed", false);
    }
    setLoading(prev => ({ ...prev, contract: false }));
  };
  
  const fetchGroupMembers = async () => {
    if (!address) return showNotification("Please connect wallet", false);
    try {
      const iface = new ethers.Interface(contractABI);
      const data = iface.encodeFunctionData('getGroupMembers', [groupId]);
      
      const result = await ethereum.request({
        method: 'eth_call',
        params: [
          {
            from: address,
            to: contractAddress,
            data: data
          },
          'latest'
        ]
      });
      
      const decodedResult = iface.decodeFunctionResult('getGroupMembers', result);
      setGroupMembersList(decodedResult[0]);
    } catch (error) {
      console.error(error);
      showNotification("Failed to fetch members", false);
    }
  };
  
  const fetchGroupBalances = async () => {
    if (!address) return showNotification("Please connect wallet", false);
    try {
      const iface = new ethers.Interface(contractABI);
      const data = iface.encodeFunctionData('getGroupBalances', [groupId]);
      
      const result = await ethereum.request({
        method: 'eth_call',
        params: [
          {
            from: address,
            to: contractAddress,
            data: data
          },
          'latest'
        ]
      });
      
      const decodedResult = iface.decodeFunctionResult('getGroupBalances', result);
      setGroupBalances(decodedResult[0].map(b => ethers.formatEther(b)));
    } catch (error) {
      console.error(error);
      showNotification("Failed to fetch balances", false);
    }
  };

  return (
    <div className="px-4 w-full vh-full pb-5 bg-black">
    <h1 className="text-3xl font-bold text-center mb-6 text-white hover:text-orange-500 hover:animate-shake transition-all duration-500">
  Expense Manager
</h1>



    {/* Wallet Connection Section */}
    <section className="mb-6 bg-black rounded-xl p-4 border-2">
      <h2 className="text-xl font-semibold mb-4 text-white ">Wallet Connection</h2>
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <div className="text-body1 font-semibold mb-2 text-brand_1">
          {address ? 'Connected' : 'Not Connected'}
        </div>
        {address && (
          <>
            <div className="text-body1 font-semibold mb-2">Address</div>
            <p className="break-all">{address}</p>
          </>
        )}
      </div>
      <Btn 
        text={address ? 'Disconnect' : 'Connect Wallet'} 
        loading={loading.connect}
        onClick={address ? () => ethereum?.disconnect?.() : connectWallet} 
        className="bg-orange-500 hover:bg-orange-400"
      />
    </section>

    {/* Network Selection Section */}
    <section className="mb-6 bg-black rounded-xl p-4 border-2">
      <h2 className="text-xl font-semibold mb-4 text-white">Network Selection</h2>
      <select
        value={chainId}
        onChange={(e) => switchChain(e.target.value)}
        className="w-full p-2 border rounded mb-4"
        disabled={loading.chain || !address}
      >
        {CHAINS.map(chain => (
          <option key={chain.chainId} value={chain.chainId}>
            {chain.chainName}
          </option>
        ))}
      </select>
      <div className="p-4 bg-gray-100 rounded-lg">
        <div className="text-body1 font-semibold">
          Chain Id: <span className="text-Orange">{chainId}</span>
        </div>
      </div>
    </section>

      {/* Create Group Section */}
      <section className="mb-6 bg-black rounded-xl p-4 border-2">
        <h2 className="text-xl font-semibold mb-4 text-white">Create Group</h2>
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="text"
          placeholder="Members (comma-separated addresses)"
          value={groupMembers.join(',')}
          onChange={(e) => setGroupMembers(e.target.value.split(','))}
          className="w-full p-2 mb-2 border rounded"
        />
        <Btn 
          text="Create Group"
          loading={loading.contract}
          onClick={createGroup}
          className="bg-orange-500 hover:bg-orange-400"
        />

        <div className="text-white pt-2">
        {`group created with ID: ${groupId}`}
          </div>
      </section>

      {/* Add Expense Section */}
      <section className="mb-6 bg-black rounded-xl p-4 border-2">
        <h2 className="text-xl font-semibold mb-4 text-white">Add Expense</h2>
        <input
          type="text"
          placeholder="Group ID"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="text"
          placeholder="Payer Address"
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="text"
          placeholder="Payees (comma-separated)"
          value={payees.join(',')}
          onChange={(e) => setPayees(e.target.value.split(','))}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="number"
          placeholder="Amount (tBNB)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <Btn 
          text="Add Expense"
          loading={loading}
          onClick={addExpense}
            className="bg-orange-500 hover:bg-orange-400"
        />
      </section>

      {/* Settle Debt Section */}
      <section className="mb-6 bg-black rounded-xl p-4 border-2">
        <h2 className="text-xl font-semibold mb-4 text-white">Settle Debt</h2>
        <input
          type="text"
          placeholder="Group ID"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="text"
          placeholder="Payee Address"
          value={payeeAddress}
          onChange={(e) => setPayeeAddress(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="number"
          placeholder="Amount (tBNB)"
          value={settleAmount}
          onChange={(e) => setSettleAmount(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
        <Btn 
          text="Settle Debt"
          loading={loading}
          onClick={settleDebt}
            className="bg-orange-500 hover:bg-orange-400"
        />
      </section>

      {/* View Group Info Section */}
      <section className="mb-6 bg-black rounded-xl p-4 border-2">
        <div className="flex gap-4 mb-4">
          <Btn 
            text="View Members"
            onClick={fetchGroupMembers}
              className="bg-orange-500 hover:bg-orange-400"
          />
          <Btn 
            text="View Balances"
            onClick={fetchGroupBalances}
              className="bg-orange-500 hover:bg-orange-400"
          />
        </div>
        
        {groupMembersList.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2 text-white">Group Members:</h3>
            <ul className="list-disc pl-5 text-white">
              {groupMembersList.map((member, index) => (
                <li key={index} className="break-all text-white">{member}</li>
              ))}
            </ul>
          </div>
        )}
        
        {groupBalances.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-white">Balances:</h3>
            <ul className="list-disc pl-5 text-white">
              {groupBalances.map((balance, index) => (
                <li key={index}>{balance} tBNB</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExpenseManager;