"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type ExamQuestionInfo = {
  id: number;
  position: number;
  selected_option_id: number | null;
};

export type ExamData = {
  seriesName: string;
  questions: ExamQuestionInfo[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  isActive: boolean;
  submitting: boolean;
  readOnly: boolean;
  isSubmitted: boolean;
};

export type ExamContextType = {
  examData: ExamData | null;
  setExamData: (data: ExamData | null) => void;
  setCurrentQuestionIndex: (index: number) => void;
  handleSubmit: () => void;
  flushPendingSave: () => Promise<void>;
  registerHandlers: (handlers: {
    setCurrentQuestionIndex: (index: number) => void;
    handleSubmit: () => void;
    flushPendingSave: () => Promise<void>;
  }) => void;
};

const ExamContext = createContext<ExamContextType | null>(null);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [examData, setExamDataState] = useState<ExamData | null>(null);
  const [handlers, setHandlersState] = useState<{
    setCurrentQuestionIndex: (index: number) => void;
    handleSubmit: () => void;
    flushPendingSave: () => Promise<void>;
  }>({
    setCurrentQuestionIndex: () => {},
    handleSubmit: () => {},
    flushPendingSave: async () => {},
  });

  const setExamData = useCallback((data: ExamData | null) => {
    setExamDataState(data);
  }, []);

  const registerHandlers = useCallback((newHandlers: typeof handlers) => {
    setHandlersState(newHandlers);
  }, []);

  const setCurrentQuestionIndex = useCallback((index: number) => {
    handlers.setCurrentQuestionIndex(index);
  }, [handlers]);

  const handleSubmit = useCallback(() => {
    handlers.handleSubmit();
  }, [handlers]);

  const flushPendingSave = useCallback(async () => {
    await handlers.flushPendingSave();
  }, [handlers]);

  return (
    <ExamContext.Provider
      value={{
        examData,
        setExamData,
        setCurrentQuestionIndex,
        handleSubmit,
        flushPendingSave,
        registerHandlers,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  return useContext(ExamContext);
}
