import detectEthereumProvider from '@metamask/detect-provider';
import { Strategy, ZkIdentity } from '@zk-kit/identity';
import { generateMerkleProof, Semaphore } from '@zk-kit/protocols';
import { Contract, providers, utils } from 'ethers';
import Head from 'next/head';
import React from 'react';
import styles from '../styles/Home.module.css';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
	Button,
	Card,
	CardContent,
	TextField,
	Typography,
} from '@mui/material';
import Greeter from 'artifacts/contracts/Greeters.sol/Greeters.json';

export default function Home() {
	const [logs, setLogs] = React.useState('Connect your wallet and greet!');

	async function greet() {
		setLogs('Creating your Semaphore identity...');

		const provider = (await detectEthereumProvider()) as any;

		await provider.request({ method: 'eth_requestAccounts' });

		const ethersProvider = new providers.Web3Provider(provider);
		const signer = ethersProvider.getSigner();
		const message = await signer.signMessage(
			'Sign this message to create your identity!'
		);

		const identity = new ZkIdentity(Strategy.MESSAGE, message);
		const identityCommitment = identity.genIdentityCommitment();
		const identityCommitments = await (
			await fetch('./identityCommitments.json')
		).json();

		const merkleProof = generateMerkleProof(
			20,
			BigInt(0),
			identityCommitments,
			identityCommitment
		);

		setLogs('Creating your Semaphore proof...');

		const greeting = 'Hello world';

		const witness = Semaphore.genWitness(
			identity.getTrapdoor(),
			identity.getNullifier(),
			merkleProof,
			merkleProof.root,
			greeting
		);

		const { proof, publicSignals } = await Semaphore.genProof(
			witness,
			'./semaphore.wasm',
			'./semaphore_final.zkey'
		);
		const solidityProof = Semaphore.packToSolidityProof(proof);

		const response = await fetch('/api/greet', {
			method: 'POST',
			body: JSON.stringify({
				greeting,
				nullifierHash: publicSignals.nullifierHash,
				solidityProof: solidityProof,
			}),
		});

		if (response.status === 500) {
			const errorMessage = await response.text();

			setLogs(errorMessage);
		} else {
			setLogs('Your anonymous greeting is onchain :)');
		}
	}

	// yup and hook form
	const userScheme = yup.object({
		name: yup.string().required(),
		age: yup.number().required().positive().integer(),
		address: yup.string().required(),
	});
	const { handleSubmit, control } = useForm({
		resolver: yupResolver(userScheme),
	});
	function onSubmit(data) {
		console.log(data);
	}

	const UserForm = () => (
		<Card className={styles.card}>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
					<Controller
						name="name"
						control={control}
						defaultValue=""
						rules={{ required: 'Name is required' }}
						render={({ field: { onChange, value }, fieldState: { error } }) => (
							<TextField
								fullWidth
								label="Name"
								variant="filled"
								value={value}
								onChange={onChange}
								error={!!error}
								helperText={error ? error.message : null}
							/>
						)}
					/>
					<Controller
						name="age"
						control={control}
						defaultValue=""
						rules={{ required: 'Age is required' }}
						render={({ field: { onChange, value }, fieldState: { error } }) => (
							<TextField
								fullWidth
								label="Age"
								variant="filled"
								value={value}
								onChange={onChange}
								error={!!error}
								helperText={error ? error.message : null}
							/>
						)}
					/>
					<Controller
						name="address"
						control={control}
						defaultValue=""
						rules={{ required: 'Address is required' }}
						render={({ field: { onChange, value }, fieldState: { error } }) => (
							<TextField
								fullWidth
								label="Address"
								variant="filled"
								value={value}
								onChange={onChange}
								error={!!error}
								helperText={error ? error.message : null}
							/>
						)}
					/>
					<Button variant="contained" type="submit" color="primary">
						Submit
					</Button>
				</form>
			</CardContent>
		</Card>
	);

	// greeting
	const [greeting, setGreeting] = React.useState('');
	React.useEffect(() => {
		listenGreeting();
	}, []);
	const listenGreeting = () => {
		try {
			const contract = new Contract(
				'0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
				Greeter.abi
			);
			const provider = new providers.JsonRpcProvider('http://localhost:8545');
			const greeterContract = contract.connect(provider.getSigner());
			greeterContract.on('NewGreeting', (greeting: string) => {
				console.log(utils.parseBytes32String(greeting));
				setGreeting(utils.parseBytes32String(greeting));
			});
		} catch (error) {
			console.error(error);
		}
	};
	const GreetingCard = () => (
		<Card className={styles.card}>
			<CardContent>
				<Typography gutterBottom>Greeting: {greeting}</Typography>
			</CardContent>
		</Card>
	);

	return (
		<div className={styles.container}>
			<Head>
				<title>Greetings</title>
				<meta
					name="description"
					content="A simple Next.js/Hardhat privacy application with Semaphore."
				/>
				<link rel="icon" href="/favicon.ico" />
			</Head>

			<main className={styles.main}>
				<h1 className={styles.title}>Greetings</h1>

				<p className={styles.description}>
					A simple Next.js/Hardhat privacy application with Semaphore.
				</p>

				<div className={styles.logs}>{logs}</div>

				<div onClick={() => greet()} className={styles.button}>
					Greet
				</div>

				<UserForm />
				<GreetingCard />
			</main>
		</div>
	);
}
