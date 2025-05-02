export interface Room {
	phrase: string;
	repetition: number;
	ownerName: string;
	partnerName: string;
	createdBy: string;
	hits: number;
	misses: number;
	currentPhrase: string;
	roomId: string;
	status: "playing" | "finished";
	messages: Message[];
}

export interface Message {
	id: string;
	content: string;
	createdAt: Date;
	correct: boolean;
}
