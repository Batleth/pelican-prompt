
import React from 'react';
import { Prompt, Partial } from '../../../types';
import {
    Dialog,
    Bar,
    Button,
    Label,
    Select,
    Option,
    Input
} from '@ui5/webcomponents-react';

interface ParameterDialogProps {
    open: boolean;
    prompt: Prompt | null;
    onClose: () => void;
    onCopyRaw: () => void;
    onCopyWithParams: () => void;
    paramValues: Record<string, string>;
    setParamValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    pickerValues: Record<string, string>;
    setPickerValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    pickerOptions: Record<string, Partial[]>;
}

export const ParameterDialog: React.FC<ParameterDialogProps> = ({
    open,
    prompt,
    onClose,
    onCopyRaw,
    onCopyWithParams,
    paramValues,
    setParamValues,
    pickerValues,
    setPickerValues,
    pickerOptions
}) => {
    return (
        <Dialog
            open={open}
            headerText="Configure Prompt"
            onClose={onClose}
            footer={
                <Bar
                    endContent={
                        <>
                            <Button onClick={onClose}>Cancel</Button>
                            <Button design="Transparent" onClick={onCopyRaw}>Copy with Placeholders</Button>
                            <Button design="Emphasized" onClick={onCopyWithParams}>Copy</Button>
                        </>
                    }
                />
            }
        >
            <div style={{ padding: '1rem', minWidth: '400px' }}>
                {/* Partial Pickers */}
                {prompt?.partialPickers && prompt.partialPickers.length > 0 && (
                    <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sapContent_LabelColor)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Options
                        </div>
                        {prompt.partialPickers.map(picker => (
                            <div key={picker.path} style={{ marginBottom: '12px' }}>
                                <Label>Select {picker.path}</Label>
                                <Select
                                    style={{ width: '100%' }}
                                    onChange={(e: any) => {
                                        setPickerValues(prev => ({ ...prev, [picker.path]: e.detail.selectedOption.dataset.value }));
                                    }}
                                >
                                    {(pickerOptions[picker.path] || []).map(opt => (
                                        <Option
                                            key={opt.path}
                                            data-value={opt.path}
                                            selected={pickerValues[picker.path] === opt.path}
                                        >
                                            {opt.path.split('.').pop() || opt.path}
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        ))}
                        <div style={{ marginBottom: '16px' }} />
                    </>
                )}

                {/* Parameters */}
                {prompt?.parameters && prompt.parameters.length > 0 && (
                    <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sapContent_LabelColor)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Parameters
                        </div>
                        {prompt.parameters.map(param => (
                            <div key={param} style={{ marginBottom: '12px' }}>
                                <Label>{param}</Label>
                                <Input
                                    style={{ width: '100%' }}
                                    value={paramValues[param] || ''}
                                    onInput={(e: any) => {
                                        setParamValues(prev => ({ ...prev, [param]: e.target.value }));
                                    }}
                                    onKeyDown={(e: any) => {
                                        if (e.key === 'Enter') {
                                            onCopyWithParams();
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </>
                )}
            </div>
        </Dialog>
    );
};
