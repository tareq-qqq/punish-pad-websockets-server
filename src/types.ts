export interface Room {
	phrase: string;
	repetition: number;
	ownerName: string;
	partnerName: string;
	createdBy: string;
	hits: number;
	misses: number;
	currentPhrase: string;
}
