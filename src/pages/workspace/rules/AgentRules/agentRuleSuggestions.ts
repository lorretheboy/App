type AgentRuleSuggestion = {
    /** Unique identifier passed as a route param to prefill the rule form */
    id: string;

    /** Label shown in the suggestions menu */
    title: string;

    /** Prompt prefilled into the rule form when the suggestion is selected */
    prompt: string;
};

// Suggested agent rules surfaced when adding a rule. Fed from a constant for now; the source can later be swapped to an Onyx read without touching the menu.
const AGENT_RULE_SUGGESTIONS: AgentRuleSuggestion[] = [
    {
        id: 'requireReceipts',
        title: 'Require receipts on large expenses',
        prompt: 'Require a receipt for every expense over $25.',
    },
    {
        id: 'flagLargeExpenses',
        title: 'Flag large expenses for review',
        prompt: 'Flag any expense over $1,000 so it can be reviewed manually.',
    },
    {
        id: 'requireCategories',
        title: 'Require a category on every expense',
        prompt: 'Make sure every expense has a category assigned before it is submitted.',
    },
];

export default AGENT_RULE_SUGGESTIONS;
export type {AgentRuleSuggestion};
